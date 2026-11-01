use crate::store::{Store,TaskRecord};
use reqwest::Client;
use serde_json::{json,Value};
use std::{env,sync::Arc,time::Duration};

#[derive(Clone)]
pub struct WorkerConfig { pub base_url:String,pub model:String,pub api_key:String,pub client:Client }
impl WorkerConfig {
 pub fn from_env()->Self {
  let base_url=env::var("KEVIN_AI_BASE_URL").unwrap_or_default().trim_end_matches('/').to_string();
  let model=env::var("KEVIN_AI_MODEL").unwrap_or_default();
  let api_key=env::var("KEVIN_AI_API_KEY").unwrap_or_default();
  Self{base_url,model,api_key,client:Client::builder().timeout(Duration::from_secs(150)).build().unwrap_or_default()}
 }
 pub fn configured(&self)->bool{!self.base_url.is_empty()&&!self.model.is_empty()&&( !self.api_key.is_empty() || self.base_url.contains("localhost") || self.base_url.contains("127.0.0.1"))}
 pub fn model_label(&self)->String{if self.configured(){self.model.clone()}else{"Not configured".into()}}
}
fn persona(task:&TaskRecord)->(&'static str,&'static str){
 match task.department.as_str(){
 "management"=>("Kevin Manager","Coordinate work, break down complex requests and produce actionable plans, decisions and clear deliverables."),
 "development"=>("Apollo Development Worker","Help with software engineering: inspect supplied context, explain changes, produce implementation-ready code, tests and review notes. Never claim to have changed a repository or run tests unless tools actually did so."),
 "pc"=>("PC Operations Worker","Prepare safe Windows workflows, scripts and troubleshooting steps. Never claim to have operated the user's computer or accessed files."),
 "telegram"=>("Telegram Manager","Draft Telegram posts, replies, moderation guidance and bot workflows. Never claim a message was sent or a group was changed."),
 "trading"=>("Trading Intelligence Worker","Provide educational market-structure analysis from user-provided data, risk-aware plans and journal reviews. Never invent live prices, guarantee outcomes or place trades."),
 "news"=>("News Intelligence Worker","Synthesize only source material supplied in the task. Clearly identify missing sources and never invent citations or breaking news."),
 "students"=>("Student Academy Worker","Prepare course plans, student communications, reports and administrative workflows. Never invent student records, attendance or payment status."),
 _=>("Kevin AI Worker","Produce a useful, honest deliverable for the task.")
 }
}
async fn execute(cfg:&WorkerConfig,task:&TaskRecord)->Result<String,String>{
 let (name,role)=persona(task);
 let system=format!("You are {name}, a real AI worker inside KEVIN AI OFFICE. {role}\nDo the useful work now, not merely promise to do it. Return a structured, practical deliverable with a short summary and clear next steps. Be honest about missing integrations, data and permissions. Do not claim external actions, code changes, messages sent, payments, device operations or live data access that did not occur. Any public, financial, destructive or account-changing action requires a separate connected tool and explicit owner approval.");
 let prompt=format!("Task title: {}\nDepartment: {}\nPriority: {}\nInstructions and context:\n{}\n\nProduce the best complete deliverable possible using only the information and capabilities available in this task.",task.title,task.department,task.priority,task.description);
 let url=format!("{}/chat/completions",cfg.base_url);
 let mut req=cfg.client.post(url).json(&json!({"model":cfg.model,"messages":[{"role":"system","content":system},{"role":"user","content":prompt}],"temperature":0.35,"max_tokens":2200}));
 if !cfg.api_key.is_empty(){req=req.bearer_auth(&cfg.api_key);}
 let response=req.send().await.map_err(|e|format!("AI provider request failed: {e}"))?;
 let status=response.status();
 let body:Value=response.json().await.map_err(|e|format!("AI provider returned invalid JSON: {e}"))?;
 if !status.is_success(){return Err(body["error"]["message"].as_str().unwrap_or("AI provider rejected the request").to_string())}
 let content=body["choices"][0]["message"]["content"].as_str().unwrap_or("").trim().to_string();
 if content.is_empty(){return Err("AI provider returned an empty response.".into())}
 Ok(content)
}
pub async fn run(store:Store,cfg:Arc<WorkerConfig>){
 loop{
  if !cfg.configured(){tokio::time::sleep(Duration::from_secs(4)).await;continue}
  match store.claim_next_task("kevin-ai-worker"){
   Ok(Some(task))=>{
    let id=task.id.clone();
    match execute(&cfg,&task).await{
     Ok(result)=>{if let Err(e)=store.complete_task(&id,&result){eprintln!("Could not persist worker result: {e}")}}
     Err(e)=>{let _=store.fail_task(&id,&e);}
    }
   }
   Ok(None)=>tokio::time::sleep(Duration::from_secs(2)).await,
   Err(e)=>{eprintln!("Worker queue error: {e}");tokio::time::sleep(Duration::from_secs(3)).await;}
  }
 }
}
