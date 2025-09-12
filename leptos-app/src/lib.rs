mod app;
use app::App;
use leptos::*;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

#[wasm_bindgen(start)]
pub fn main_js() {
    console_error_panic_hook::set_once();
    let window = web_sys::window().unwrap();
    let document = window.document().unwrap();
    if let Some(el) = document.get_element_by_id("comments-root") {
        if let Ok(html_el) = el.dyn_into::<web_sys::HtmlElement>() {
            leptos::mount_to(html_el, || view! { <App/> });
        } else {
            mount_to_body(|| view! { <App/> });
        }
    } else {
        mount_to_body(|| view! { <App/> });
    }
}
