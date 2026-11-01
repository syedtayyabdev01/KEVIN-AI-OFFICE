mod store;
use axum::{extract::{Path,State},http::{header,HeaderMap,HeaderValue,Method,StatusCode},routing::{get,post},Json,Router};
use serde::{Deserialize,Serialize};
use std::{env,net::SocketAddr,path::PathBuf,sync::Arc};
use subtle::ConstantTimeEq;
use tower_http::cors::CorsLayer;
#[derive(Clone)]struct AppState{store:store::Store,token:Arc<String>}
#[derive(Serialize)]struct ApiError{error:String}
#[derive(Serialize)]struct Health{ok:bool,service:&'static str,version:&'static str,apollo:&'static str}
#[derive(Serialize)]struct Agent{id:&'static str,name:&'static str,department:&'static str,description:&'static str,status:&'static str,permission:&'static str}
#[derive(Deserialize)]struct CreateTask{title:String,#[serde(default)]description:String,#[serde(default="default_department")]department:String,#[serde(default="default_priority")]priority:String}
fn default_department()->String{"management".into()}fn default_priority()->String{"normal".into()}
fn agents()->Vec<Agent>{vec![
Agent{id:"kevin-manager",name:"Kevin Manager",department:"management",description:"Plans requests and routes work.",status:"planned",permission:"plan-and-route"},
Agent{id:"apollo-development",name:"Apollo Development",department:"development",description:"Verified repository work through ApolloOffice.",status:"not_connected",permission:"repository-scoped"},
Agent{id:"pc-operator",name:"PC Operator",department:"pc",description:"Windows apps, files and browser workflows.",status:"not_connected",permission:"approval-required"},
Agent{id:"telegram-manager",name:"Telegram Manager",department:"telegram",description:"Telegram messages, groups and moderation.",status:"not_connected",permission:"draft-first"},
Agent{id:"tradingview-agent",name:"TradingView Agent",department:"trading",description:"Charts, alerts and trading journal.",status:"not_connected",permission:"read-only"},
Agent{id:"news-intelligence",name:"News Intelligence",department:"news",description:"Source-backed monitoring and research.",status:"not_connected",permission:"read-only"},
Agent{id:"student-manager",name:"Student Manager",department:"students",description:"Students, courses, batches, attendance and fees.",status:"not_connected",permission:"approval-required"}]}
fn authorized(h:&HeaderMap,t:&str)->bool{let Some(v)=h.get(header::AUTHORIZATION).and_then(|v|v.to_str().ok())else{return false};let Some(c)=v.strip_prefix("Bearer ")else{return false};bool::from(c.as_bytes().ct_eq(t.as_bytes()))}
fn err(s:StatusCode,m:impl Into<String>)->(StatusCode,Json<ApiError>){(s,Json(ApiError{error:m.into()}))}
fn auth(h:&HeaderMap,t:&str)->Result<(),(StatusCode,Json<ApiError>)>{if authorized(h,t){Ok(())}else{Err(err(StatusCode::UNAUTHORIZED,"A valid local bearer token is required."))}}
fn validate(x:&CreateTask)->Result<(),String>{let t=x.title.trim();if t.len()<3||t.len()>120{return Err("Task title must be 3-120 characters.".into())}if x.description.len()>6000{return Err("Description exceeds 6000 characters.".into())}if !["management","development","pc","telegram","trading","news","students"].contains(&x.department.as_str()){return Err("Unknown department.".into())}if !["low","normal","high","urgent"].contains(&x.priority.as_str()){return Err("Invalid priority.".into())}Ok(())}
async fn health()->Json<Health>{Json(Health{ok:true,service:"KEVIN Local Agent",version:env!("CARGO_PKG_VERSION"),apollo:"not-connected"})}
async fn get_agents(State(s):State<AppState>,h:HeaderMap)->Result<Json<Vec<Agent>>,(StatusCode,Json<ApiError>)>{auth(&h,&s.token)?;Ok(Json(agents()))}
async fn get_tasks(State(s):State<AppState>,h:HeaderMap)->Result<Json<Vec<store::TaskRecord>>,(StatusCode,Json<ApiError>)>{auth(&h,&s.token)?;s.store.list_tasks().map(Json).map_err(|e|err(StatusCode::INTERNAL_SERVER_ERROR,e))}
async fn create_task(State(s):State<AppState>,h:HeaderMap,Json(x):Json<CreateTask>)->Result<(StatusCode,Json<store::TaskRecord>),(StatusCode,Json<ApiError>)>{auth(&h,&s.token)?;validate(&x).map_err(|e|err(StatusCode::BAD_REQUEST,e))?;let t=s.store.create_task(&x).map_err(|e|err(StatusCode::INTERNAL_SERVER_ERROR,e))?;Ok((StatusCode::CREATED,Json(t)))}
async fn approve(State(s):State<AppState>,h:HeaderMap,Path(id):Path<String>)->Result<Json<store::TaskRecord>,(StatusCode,Json<ApiError>)>{auth(&h,&s.token)?;s.store.approve_task(&id).map(Json).map_err(|e|err(StatusCode::CONFLICT,e))}
async fn cancel(State(s):State<AppState>,h:HeaderMap,Path(id):Path<String>)->Result<Json<store::TaskRecord>,(StatusCode,Json<ApiError>)>{auth(&h,&s.token)?;s.store.cancel_task(&id).map(Json).map_err(|e|err(StatusCode::CONFLICT,e))}
#[tokio::main]async fn main()->Result<(),Box<dyn std::error::Error+Send+Sync>>{
let token=env::var("KEVIN_AGENT_TOKEN").unwrap_or_default();if token.len()<32{eprintln!("Set KEVIN_AGENT_TOKEN to a random value of at least 32 characters.");std::process::exit(2)}
let dir=env::var_os("KEVIN_OFFICE_DATA_DIR").map(PathBuf::from).unwrap_or_else(||PathBuf::from("apps/kevin-agent/data"));std::fs::create_dir_all(&dir)?;
let store=store::Store::open(dir.join("kevin-office.sqlite3")).map_err(std::io::Error::other)?;
let state=AppState{store,token:Arc::new(token)};
let cors=CorsLayer::new().allow_origin([HeaderValue::from_static("http://localhost:5173"),HeaderValue::from_static("http://127.0.0.1:5173")]).allow_methods([Method::GET,Method::POST,Method::OPTIONS]).allow_headers([header::AUTHORIZATION,header::CONTENT_TYPE]);
let app=Router::new().route("/api/health",get(health)).route("/api/agents",get(get_agents)).route("/api/tasks",get(get_tasks).post(create_task)).route("/api/tasks/{id}/approve",post(approve)).route("/api/tasks/{id}/cancel",post(cancel)).with_state(state).layer(cors);
let addr=SocketAddr::from(([127,0,0,1],47310));let listener=tokio::net::TcpListener::bind(addr).await?;println!("KEVIN Local Agent listening on http://{addr}");axum::serve(listener,app).await?;Ok(())}
#[cfg(test)]mod tests{use super::*;#[test]fn rejects_short_title(){let x=CreateTask{title:"no".into(),description:String::new(),department:"management".into(),priority:"normal".into()};assert!(validate(&x).is_err())}#[test]fn accepts_valid_task(){let x=CreateTask{title:"Build dashboard".into(),description:"test".into(),department:"development".into(),priority:"high".into()};assert!(validate(&x).is_ok())}#[test]fn token_is_exact(){let mut h=HeaderMap::new();h.insert(header::AUTHORIZATION,HeaderValue::from_static("Bearer abcdefghijklmnopqrstuvwxyz123456"));assert!(authorized(&h,"abcdefghijklmnopqrstuvwxyz123456"));assert!(!authorized(&h,"wrong"))}#[test]fn agents_have_honest_status(){assert_eq!(agents().len(),7);assert!(agents().iter().all(|a|["planned","not_connected"].contains(&a.status)))}}