use leptos::*;
use serde::{Deserialize, Serialize};
use wasm_bindgen::JsCast;
use wasm_bindgen::closure::Closure;
use wasm_bindgen_futures::JsFuture;
use web_sys::{window, Event, MouseEvent};
use std::rc::Rc;
use std::cell::Cell;

#[derive(Serialize, Clone)]
#[serde(tag = "type")]
enum Selector {
    #[serde(rename = "TextQuoteSelector")]
    TextQuote {
        exact: String,
        prefix: Option<String>,
        suffix: Option<String>,
    },
    #[serde(rename = "TextPositionSelector")]
    TextPosition {
        start: usize,
        end: usize,
        unit: &'static str,
    },
}

#[derive(Serialize, Clone)]
struct Target {
    source: String,
    selector: Vec<Selector>,
}

#[derive(Serialize, Clone)]
struct Envelope {
    r#type: &'static str,
    target: Target,
}

fn path_slug() -> Option<String> {
    let loc = window()?.location();
    let path = loc.pathname().ok()?;
    let parts: Vec<_> = path.split('/').filter(|s| !s.is_empty()).collect();
    if parts.len() >= 2 && parts[0] == "posts" {
        Some(parts[1].to_string())
    } else {
        None
    }
}

fn article_plain_text() -> Option<String> {
    let doc = window()?.document()?;
    let article = doc.query_selector("article").ok().flatten()?;
    Some(article.text_content().unwrap_or_default())
}

fn current_selection() -> Option<(String, usize, usize)> {
    let sel = window()?.get_selection().ok().flatten()?;
    if sel.range_count() == 0 {
        return None;
    }
    let js = sel.to_string();
    let text: String = js.into();
    if text.is_empty() {
        return None;
    }
    // naive position via plain_text find
    let plain = article_plain_text()?;
    let start = plain.find(&text)?;
    let end = start + text.chars().count();
    Some((text, start, end))
}

fn selection_rect() -> Option<(f64, f64)> {
    let win = window()?;
    let sel = win.get_selection().ok().flatten()?;
    if sel.range_count() == 0 { return None; }
    let range = sel.get_range_at(0).ok()?;
    if let Some(rects) = range.get_client_rects() {
        if let Ok(val) = js_sys::Reflect::get(rects.as_ref(), &wasm_bindgen::JsValue::from_str("0")) {
            if let Ok(rect) = val.dyn_into::<web_sys::DomRectReadOnly>() {
                return Some((rect.right() + 6.0, rect.bottom() + 6.0));
            }
        }
    }
    None
}

fn collapse_selection() {
    if let Some(sel) = window().and_then(|w| w.get_selection().ok().flatten()) {
        let _ = sel.collapse_to_end();
    }
}

fn wrap_selection_with_mark(class_name: &str) {
    if let Some(win) = window() {
        if let Some(sel) = win.get_selection().ok().flatten() {
            if sel.range_count() > 0 {
                if let Ok(range) = sel.get_range_at(0) {
                    if let Some(doc) = win.document() {
                        if let Ok(mark) = doc.create_element("mark") {
                            mark.set_class_name(class_name);
                            let _ = range.surround_contents(&mark);
                        }
                    }
                }
            }
        }
    }
}

async fn post_annotation(
    slug: &str,
    env: Envelope,
    quote: &str,
    display_name: Option<String>,
    body_html: String,
) -> Result<(), String> {
    #[derive(Serialize)]
    struct Body<'a> {
        post_slug: &'a str,
        display_name: Option<&'a str>,
        body_html: String,
        selectors: Envelope,
        quote: &'a str,
        turnstile_token: &'a str,
        idempotency_key: String,
    }
    let body = Body {
        post_slug: slug,
        display_name: display_name.as_deref(),
        body_html,
        selectors: env,
        quote,
        turnstile_token: "test-anything",
        idempotency_key: format!("id-{}", js_sys::Date::now()),
    };
    let req_init = web_sys::RequestInit::new();
    req_init.set_method("POST");
    let body_str = serde_json::to_string(&body).map_err(|e| e.to_string())?;
    req_init.set_body(&wasm_bindgen::JsValue::from_str(&body_str));
    let req = web_sys::Request::new_with_str_and_init("/api/annotations/create", &req_init)
        .map_err(|e| format!("{:?}", e))?;
    req.headers().set("Content-Type", "application/json").ok();
    req.headers().set("Accept", "application/json").ok();
    let resp_val = JsFuture::from(window().unwrap().fetch_with_request(&req))
        .await
        .map_err(|e| format!("{:?}", e))?;
    let resp: web_sys::Response = resp_val.dyn_into().unwrap();
    if !resp.ok() {
        return Err(format!("status {}", resp.status()));
    }
    Ok(())
}

fn build_envelope(slug: &str, exact: &str, start: usize, end: usize) -> Envelope {
    let plain = article_plain_text().unwrap_or_default();
    let start_idx = start.saturating_sub(20);
    let prefix = if start > 0 {
        Some(plain.chars().skip(start_idx).take(start - start_idx).collect())
    } else { None };
    let total = plain.chars().count();
    let suffix = if end < total { Some(plain.chars().skip(end).take(20).collect()) } else { None };
    Envelope {
        r#type: "Annotation",
        target: Target {
            source: format!("/posts/{}", slug),
            selector: vec![
                Selector::TextQuote {
                    exact: exact.to_string(),
                    prefix,
                    suffix,
                },
                Selector::TextPosition {
                    start,
                    end,
                    unit: "codepoint",
                },
            ],
        },
    }
}

#[component]
pub fn App() -> impl IntoView {
    #[derive(Serialize, Deserialize, Clone)]
    struct Annotation {
        id: i64,
        display_name: Option<String>,
        body_html: String,
        parent_id: Option<i64>,
        created_at: Option<String>,
    }

    let slug: Rc<Option<String>> = Rc::new(path_slug());
    let (status, set_status) = create_signal(String::new());

    // Load annotations
    let slug_for_res = slug.clone();
    let annotations = create_resource(move || slug_for_res.clone(), |slug_rc: Rc<Option<String>>| async move {
        let mut out: Vec<Annotation> = vec![];
        if let Some(slug) = (*slug_rc).clone() {
            let url = format!("/api/annotations/list?slug={}", slug);
            if let Ok(resp_val) = JsFuture::from(window().unwrap().fetch_with_str(&url)).await {
                if let Ok(resp) = resp_val.dyn_into::<web_sys::Response>() {
                    if resp.ok() {
                        if let Ok(text_js) = JsFuture::from(resp.text().unwrap()).await {
                            if let Some(text) = text_js.as_string() {
                                out = serde_json::from_str(&text).unwrap_or_default();
                            }
                        }
                    }
                }
            }
        }
        out
    });

    // Compose state
    let (compose_open, set_compose_open) = create_signal(false);
    let (compose_quote, set_compose_quote) = create_signal(String::new());
    let (compose_env, set_compose_env) = create_signal::<Option<Envelope>>(None);
    let (input_name, set_input_name) = create_signal(String::new());
    let (input_body, set_input_body) = create_signal(String::new());

    // Sidebar overlay state (mobile)
    let (sidebar_open, set_sidebar_open) = create_signal(false);

    // Selection popover state
    #[derive(Clone)]
    struct PopState { show: bool, x: f64, y: f64, preview: String }
    let (pop, set_pop) = create_signal(PopState { show: false, x: 0.0, y: 0.0, preview: String::new() });

    // Comments (dev.to-like) state
    let (comments_open, set_comments_open) = create_signal(false);
    let (comment_draft_created, set_comment_draft_created) = create_signal(false);
    let (comment_input, set_comment_input) = create_signal(String::new());

    // Toast state
    let (toast_msg, set_toast_msg) = create_signal(String::new());
    let (toast_show, set_toast_show) = create_signal(false);
    let show_toast = move |msg: &str| {
        set_toast_msg.set(msg.to_string());
        set_toast_show.set(true);
        if let Some(w) = window() {
            let setter = set_toast_show.clone();
            let cb = Closure::once_into_js(Box::new(move || {
                setter.set(false);
            }) as Box<dyn FnOnce()>);
            let _ = w.set_timeout_with_callback_and_timeout_and_arguments_0(cb.as_ref().unchecked_ref(), 2000);
            // no need to keep cb; JS owns it after once_into_js
        }
    };

    async fn create_comment_draft(slug: Option<String>) -> Result<(), String> {
        if slug.is_none() { return Ok(()); }
        let url = "/api/comments/open";
        let init = web_sys::RequestInit::new();
        init.set_method("POST");
        #[derive(Serialize)]
        struct Body<'a> { post_slug: &'a str }
        let body = Body { post_slug: slug.as_ref().unwrap() };
        let s = serde_json::to_string(&body).map_err(|e| e.to_string())?;
        init.set_body(&wasm_bindgen::JsValue::from_str(&s));
        let req = web_sys::Request::new_with_str_and_init(url, &init).map_err(|e| format!("{:?}", e))?;
        req.headers().set("Content-Type", "application/json").ok();
        let resp = JsFuture::from(window().unwrap().fetch_with_request(&req)).await.map_err(|e| format!("{:?}", e))?;
        let resp: web_sys::Response = resp.dyn_into().unwrap();
        if !resp.ok() { return Err(format!("status {}", resp.status())); }
        Ok(())
    }

    // Listen for selection in the article (mouseup) and show popover (run once)
    let once = Rc::new(Cell::new(false));
    let once2 = once.clone();
    let slug_for_effect = slug.clone();
    create_effect(move |_| {
        if once2.get() { return; }
        once2.set(true);
        let doc = window().unwrap().document().unwrap();
        let article = doc.query_selector("article").ok().flatten();
        let slug_in_handler = slug_for_effect.clone();
        let handler = Closure::wrap(Box::new(move |e: Event| {
            let me: MouseEvent = e.dyn_ref::<MouseEvent>().unwrap().clone();
            if let Some(target) = me.target() {
                let el = target.dyn_into::<web_sys::Node>().ok();
                if let Some(node) = el {
                    if let Some(ref art) = article {
                        if !art.contains(Some(&node)) { return; }
                    }
                    if let Some((exact, start, end)) = current_selection() {
                        if let Some((x, y)) = selection_rect() {
                            let preview = if exact.chars().count() > 80 { format!("{}…", exact.chars().take(80).collect::<String>()) } else { exact.clone() };
                            set_pop.set(PopState { show: true, x, y, preview });
                        }
                        if let Some(slug) = (*slug_in_handler).clone() {
                            let env = build_envelope(&slug, &exact, start, end);
                            set_compose_env.set(Some(env));
                            set_compose_quote.set(exact);
                            set_status.set(String::new());
                        }
                    }
                }
            }
        }) as Box<dyn FnMut(_)>);
        doc.add_event_listener_with_callback("mouseup", handler.as_ref().unchecked_ref())
            .ok();
        handler.forget();
    });

    // Handlers are inlined in the view to satisfy Fn trait requirements

    // Render sidebar list
    let list_view = move || {
        annotations.get().map(|items| {
            if items.is_empty() {
                view! { <div class="item">No comments yet.</div> }.into_view()
            } else {
                // simple grouping: roots then replies
                let mut roots: Vec<&Annotation> = items.iter().filter(|a| a.parent_id.is_none()).collect();
                let replies: Vec<&Annotation> = items.iter().filter(|a| a.parent_id.is_some()).collect();
                roots.sort_by_key(|a| a.created_at.clone());
                let nodes = roots.into_iter().map(|r| {
                    let rnode = view! { <div class="item root"><div class="meta">{r.display_name.clone().unwrap_or_else(|| "Anonymous".into())}</div><div inner_html={r.body_html.clone()}></div></div> };
                    let child_nodes = replies.iter().filter(|c| c.parent_id == Some(r.id)).map(|c| {
                        view! { <div class="item reply" style="margin-left:8px"><div class="meta">{c.display_name.clone().unwrap_or_else(|| "Anonymous".into())}</div><div inner_html={c.body_html.clone()}></div></div> }
                    }).collect_view();
                    view! { <>{rnode}{child_nodes}</> }
                }).collect_view();
                nodes.into_view()
            }
        })
    };

    // Provide slug via memo for handlers
    let slug_memo = create_memo(move |_| slug.clone());

    view! {
        <header class="site-header">
          <div class="brand">
            <div class="logo" aria-hidden="true"></div>
            <div class="title">Read + Anno</div>
          </div>
          <div class="search"><input placeholder="Search articles" /></div>
          <div class="actions">
            <button class="btn" on:click=move |_| set_sidebar_open.set(!sidebar_open.get()) aria-label="Toggle annotations">{"Menu"}</button>
          </div>
        </header>

        <main class="layout">
          <div class="left-rail">
            <div class="rail-box">
              <button class="rail-btn" title="Like">+1</button>
              <div class="rail-count">24</div>
              <button class="rail-btn" title="Comments">C</button>
              <div class="rail-count">5</div>
              <button class="rail-btn" title="Save">S</button>
            </div>
          </div>

          <article id="post" class="post content-card">
            <h1>{"注釈付きの読みやすい記事レイアウト"}</h1>
            <div class="meta-bar">
              <div class="meta-avatar" aria-hidden="true"></div>
              <div class="meta-author">{"Author Name"}</div>
              <div class="meta-dot">{"•"}</div>
              <div>{"2025-09-12"}</div>
              <div class="meta-dot">{"•"}</div>
              <div>{"7 min read"}</div>
            </div>
            <div class="tags">
              <span class="tag">{"leptos"}</span>
              <span class="tag">{"cloudflare"}</span>
              <span class="tag">{"annotations"}</span>
            </div>
            <div id="post-body" class="content-body">
              <p>{"ここはデモ用の本文です。任意の一文を選択すると、右下にポップオーバーが表示され、コメント作成フローに進めます。行長は読みやすさを意識して調整されています。"}</p>
              <p>{"選択→Add commentで、右レール上部にComposerが開きます。送信は楽観更新の方針で、あなたの投稿は淡いシアン色でハイライトされます。"}</p>
              <p>{"モバイル幅では右レールがオーバーレイ表示に切り替わります。ヘッダーのボタンで開閉してください。"}</p>

              <div class="comments">
                <button class="btn btn-block" on:click=move |_| {
                  if !comments_open.get() {
                    set_comments_open.set(true);
                    let slug_opt = slug_memo.get().as_ref().clone();
                    spawn_local(async move {
                      if create_comment_draft(slug_opt.clone()).await.is_ok() {
                        set_comment_draft_created.set(true);
                      }
                    });
                  }
                }>{move || if comments_open.get() { "Comments (open)" } else { "Open comments" }}</button>

                {move || if comments_open.get() { view!{
                  <div class="comment-row">
                    <div class="comment-avatar" aria-hidden="true"></div>
                    <div class="comment-box">
                      <textarea class="comment-input" placeholder="コメントを入力…" prop:value={comment_input.get()} on:input=move |e| set_comment_input.set(event_target_value(&e))></textarea>
                      <div class="comment-actions">
                        <button class="btn btn-primary">Post</button>
                        {move || if comment_draft_created.get() { view!{ <span style="font-size:12px;opacity:.8">draft created</span> }.into_view() } else { view!{ <span></span> }.into_view() }}
                      </div>
                    </div>
                  </div>
                }.into_view()} else { view!{ <div></div> }.into_view() }}
              </div>
            </div>
          </article>

          <div class=move || if sidebar_open.get() { "sidebar-backdrop is-open" } else { "sidebar-backdrop" } on:click=move |_| set_sidebar_open.set(false)></div>
          <aside id="anno-sidebar" class=move || if sidebar_open.get() { "sidebar is-open" } else { "sidebar" } aria-label="Annotations">
            <div class="side-card">
              <div class="title">About the author</div>
              <div style="font-size:14px;opacity:.85">dev.to-like right rail card. Follow, links, etc.</div>
            </div>
            <header>
              <strong>Annotations</strong>
              <div class="controls">
                <button class="btn">Newest</button>
                <button class="btn">By text</button>
              </div>
            </header>
            <ol class="anno-list">
              {if compose_open.get() { view!{
                <li class="anno-card">
                  <div class="anno-quote">{"…"}{compose_quote.get()}{"…"}</div>
                  <div style="display:flex;flex-direction:column;gap:.5rem;margin-top:8px">
                    <input placeholder="表示名 (任意)" prop:value={input_name.get()} on:input=move |e| set_input_name.set(event_target_value(&e)) class="btn" style="padding:.4rem" />
                    <textarea placeholder="コメントを入力" prop:value={input_body.get()} on:input=move |e| set_input_body.set(event_target_value(&e)) class="btn" style="min-height:96px"></textarea>
                    <div style="display:flex;gap:.5rem">
                      <button class="btn btn-primary" on:click=move |_| {
                        let slug_opt = slug_memo.get().as_ref().clone();
                        if let (Some(slug), Some(env)) = (slug_opt, compose_env.get()) {
                            let quote = compose_quote.get();
                            let name = input_name.get();
                            let body = input_body.get();
                            spawn_local(async move {
                                match post_annotation(&slug, env, &quote, if name.is_empty() { None } else { Some(name) }, body).await {
                                    Ok(()) => {
                                        set_status.set("Sent!".into());
                                        annotations.refetch();
                                        set_compose_open.set(false);
                                        set_input_body.set(String::new());
                                        set_input_name.set(String::new());
                                    }
                                    Err(e) => set_status.set(format!("Error: {}", e)),
                                }
                            });
                        }
                      }>送信</button>
                      <button class="btn" on:click=move |_| { set_compose_open.set(false); set_status.set(String::new()); }>キャンセル</button>
                    </div>
                    <div class="status" style="color:#666;font-size:.9rem">{status.get()}</div>
                  </div>
                </li>
              }.into_view()} else { view!{ <li class="anno-card">{status.get()}</li> }.into_view()}}

              <li>
                {list_view()}
              </li>
            </ol>
          </aside>

          {move || if pop.get().show { view!{
            <div id="sel-pop" role="dialog" class="popover" style=move || format!("left: {}px; top: {}px;", pop.get().x, pop.get().y)>
              <p class="preview">{""}{pop.get().preview.clone()}</p>
              <div class="actions">
                <button class="btn btn-primary" on:click=move |_| {
                  wrap_selection_with_mark("anno anno--own");
                  collapse_selection();
                  set_pop.set(PopState { show: false, x: 0.0, y: 0.0, preview: String::new() });
                  set_compose_open.set(true);
                  set_sidebar_open.set(true);
                }>Add comment</button>
                <button class="btn" on:click=move |_| {
                  if let Some((exact, _start, _end)) = current_selection() {
                    if let Some(win) = window() {
                      if let Ok(loc) = win.location().href() {
                        let base = loc.split('#').next().unwrap_or("");
                        let frag = format!("#:~:text={}", js_sys::encode_uri_component(&exact));
                        let url = format!("{}{}", base, frag);
                        let _ = win.navigator().clipboard().write_text(&url);
                        show_toast("Link copied");
                      }
                    }
                  }
                }>Copy link</button>
                <button class="btn btn-ghost" on:click=move |_| {
                  set_pop.set(PopState { show: false, x: 0.0, y: 0.0, preview: String::new() });
                  collapse_selection();
                }>Cancel</button>
              </div>
            </div>
          }.into_view()} else { view!{ <div class="sr-only"></div> }.into_view()}}
          {move || if toast_show.get() { view!{ <div class="toast">{toast_msg.get()}</div> }.into_view() } else { view!{ <div class="sr-only"></div> }.into_view() }}
        </main>
    }
}
