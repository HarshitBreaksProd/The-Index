use axum::{Json, Router, extract::Query, http::StatusCode, response::IntoResponse, routing::get};
use fantoccini::{ClientBuilder, Locator};
use regex::Regex;
use scraper::{ElementRef, Html, Selector};
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::net::SocketAddr;
use std::time::Duration;
use std::env;
use dotenvy::dotenv;

#[derive(Deserialize)]
struct ScrapeRequest {
    url: String,
}

#[derive(Serialize)]
struct SuccessResponse {
    content: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[tokio::main]
async fn main() {
    dotenv().ok();
    let port: u16 = env::var("PORT").ok().and_then(|v| v.parse().ok()).unwrap_or(3005);
    let app = Router::new().route("/scrape", get(scrape_handler));
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Crawler service listening on {}", addr);

    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn scrape_handler(Query(params): Query<ScrapeRequest>) -> impl IntoResponse {
    println!("Received scrape request for: {}", &params.url);
    let url = params.url;

    match run_crawler(url).await {
        Ok(content) => {
            let response = SuccessResponse { content };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            println!("Sending error back {}", e);
            let error_response = ErrorResponse {
                error: e.to_string(),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)).into_response()
        }
    }
}

async fn run_crawler(url: String) -> Result<String, Box<dyn Error + Send + Sync>> {
    let webdriver_url = env::var("WEBDRIVER_URL").unwrap_or_else(|_| "http://chromedriver:4444".to_string());
    println!("Crawler attached to webdriver {}", webdriver_url);
    let mut caps = serde_json::map::Map::new();
    let chrome_opts = serde_json::json!({
      "args": [
          "--headless",
          "--disable-gpu",
          "--no-sandbox",
          "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.1 Safari/537.36"
        ]
    });
    caps.insert("goog:chromeOptions".to_string(), chrome_opts);

    let client = ClientBuilder::native()
        .capabilities(caps)
        .connect(&webdriver_url)
        .await?;

    client.goto(&url).await?;

    println!("Waiting for main content to stabilize...");
    let mut previous_content = String::new();
    let mut stable_polls = 0;
    const REQUIRED_STABLE_POLLS: i32 = 5;
    const POLLING_INTERVAL_SECS: u64 = 3;
    const MAX_ATTEMPTS: i32 = 20;

    let mut final_content_html = String::new();

    let tweet_regex =
        Regex::new(r"^(https?:\/\/)?(x\.com|twitter\.com)\/[a-zA-Z0-9_]+\/status\/[0-9]+")?;

    if tweet_regex.is_match(&url) {
        println!("✅ Detected Tweet URL. Using fast article extraction logic.");

        let mut temp_html = String::new();

        for attempt in 0..MAX_ATTEMPTS {
            let article_html = match client.find(Locator::Css("article")).await {
                Ok(element) => element.html(true).await?,
                Err(_) => {
                    println!("Attempt {}: Article tag not found yet.", attempt + 1);
                    tokio::time::sleep(Duration::from_secs(POLLING_INTERVAL_SECS)).await;
                    continue;
                }
            };

            println!(
                "Attempt {}: Current tweet length = {}",
                attempt + 1,
                article_html.len()
            );

            if article_html.len() == previous_content.len() && !article_html.is_empty() {
                stable_polls += 1;
                println!(
                    "Tweet content stable. Polls = {}/{}",
                    stable_polls, REQUIRED_STABLE_POLLS
                );
            } else {
                stable_polls = 0;
                previous_content = article_html.clone();
                println!("Tweet content changed. Resetting stability counter.");
            }

            if stable_polls >= REQUIRED_STABLE_POLLS {
                println!("Main tweet has stabilized.");
                temp_html = article_html;
                break;
            }

            tokio::time::sleep(Duration::from_secs(POLLING_INTERVAL_SECS)).await;
        }

        if temp_html.is_empty() {
            println!("Warning: Tweet did not stabilize. Using last known content.");
            final_content_html = previous_content;
        } else {
            final_content_html = temp_html;
        }
    } else {
        for attempt in 0..MAX_ATTEMPTS {
            let best_element_html = {
                let body_html = client.find(Locator::Css("body")).await?.html(true).await?;
                let fragment = Html::parse_fragment(&body_html);
                find_best_element_html(&fragment).unwrap_or_else(|| body_html.clone())
            };

            println!(
                "Attempt {}: Current content length = {}",
                attempt + 1,
                best_element_html.len()
            );

            if best_element_html.len() == previous_content.len() && !best_element_html.is_empty() {
                stable_polls += 1;
                println!(
                    "Content is stable. Polls = {}/{}",
                    stable_polls, REQUIRED_STABLE_POLLS
                );
            } else {
                stable_polls = 0;
                previous_content = best_element_html.clone();
                println!("Content changed. Resetting stability counter.");
            }

            if stable_polls >= REQUIRED_STABLE_POLLS {
                println!("Main content has stabilized. Proceeding to scrape.");
                final_content_html = best_element_html;
                break;
            }

            tokio::time::sleep(Duration::from_secs(POLLING_INTERVAL_SECS)).await;
        }

        if stable_polls < REQUIRED_STABLE_POLLS {
            println!(
                "Warning: Content did not stabilize after {} attempts. Using last known content.",
                MAX_ATTEMPTS
            );
            final_content_html = previous_content;
        }
    }
    client.close().await?;

    let formatted_text = html2text::from_read(final_content_html.as_bytes(), 80);
    let cleaned_text = formatted_text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    Ok(cleaned_text)
}

fn find_best_element_html(fragment: &Html) -> Option<String> {
    let mut best_element: Option<ElementRef> = None;
    let mut max_score = 0.0;

    let selector = Selector::parse("*").unwrap();
    for element in fragment.select(&selector) {
        let tag_name = element.value().name().to_lowercase();
        if ["script", "style", "header", "footer", "nav", "a"].contains(&tag_name.as_str()) {
            continue;
        }
        let text = element.text().collect::<String>();
        let text_length = text.trim().len() as f64;
        if text_length < 10.0 {
            continue;
        }
        let tag_count = element.children().count() as f64;
        let score = text_length / (1.0 + tag_count);
        if score > max_score {
            max_score = score;
            best_element = Some(element);
        }
    }

    best_element.map(|el| el.html())
}
