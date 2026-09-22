/**
 * KeyVault AI — playground.js
 * Playground 真实 API 请求（Local-First，请求直达 Provider，不经过任何中间服务器）
 *
 * 安全约束：
 *   - 实际 API Key 仅用于本次 fetch 的 Authorization 头，绝不写入日志
 *   - 日志只保存 keyId / provider / model / endpoint / status / latency / tokens
 *   - 默认不保存 Prompt 内容（除非用户明确启用调试日志）
 */

/** 发起一次真实 API 请求 */
async function sendPlaygroundRequest({ providerId, keyId, model, endpoint, systemPrompt, userPrompt }){
  const key = (typeof keys!=='undefined'?keys:[]).find(k=>k.id===keyId);
  if(!key) return { ok:false, error:'no_key', message:'未找到所选 API Key' };
  if(!endpoint) return { ok:false, error:'no_endpoint', message:'请填写 API Endpoint' };

  const meta = getProviderMeta(providerId);
  const isAnthropic = providerId==='anthropic';
  const headers = { 'Content-Type':'application/json' };
  let body;

  if(isAnthropic){
    headers['x-api-key'] = key.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    body = {
      model: model||'claude-3-5-sonnet',
      max_tokens: 1024,
      system: systemPrompt||undefined,
      messages: [{ role:'user', content: userPrompt||'' }]
    };
  }else{
    headers['Authorization'] = 'Bearer ' + key.apiKey;
    body = {
      model: model||'gpt-4o-mini',
      messages: [
        ...(systemPrompt?[{role:'system',content:systemPrompt}]:[]),
        { role:'user', content: userPrompt||'' }
      ]
    };
  }

  const t0 = performance.now();
  let status = 0, respText = '';
  try{
    const resp = await fetch(endpoint, {
      method:'POST',
      headers,
      body: JSON.stringify(body)
    });
    status = resp.status;
    respText = await resp.text();
  }catch(e){
    const latency = (performance.now()-t0)/1000;
    addUsageLog({ provider:providerId, keyId, model, endpoint, status:'failed', latency:+latency.toFixed(2), promptTokens:0, completionTokens:0, totalTokens:0 });
    addActivity('api_failed', keyId, { provider:providerId, error:'network' });
    if(typeof onKeyUsed==='function') onKeyUsed(keyId, false);
    return { ok:false, error:'network', message:'无法连接 Provider，请检查 Endpoint 与网络。', latency:+latency.toFixed(2) };
  }

  const latency = (performance.now()-t0)/1000;
  let data = null;
  try{ data = JSON.parse(respText); }catch{}

  if(status>=200 && status<300){
    let text='', pt=0, ct=0, tt=0;
    if(isAnthropic){
      text = (data && data.content && data.content.map(c=>c.text||'').join(''))||'';
      pt = data?.usage?.input_tokens||0;
      ct = data?.usage?.output_tokens||0;
      tt = pt+ct;
    }else{
      text = data?.choices?.[0]?.message?.content || (data?.output?.[0]?.text) || '';
      pt = data?.usage?.prompt_tokens||0;
      ct = data?.usage?.completion_tokens||0;
      tt = data?.usage?.total_tokens||pt+ct;
    }
    addUsageLog({ provider:providerId, keyId, model, endpoint, status:'success', latency:+latency.toFixed(2), promptTokens:pt, completionTokens:ct, totalTokens:tt });
    addActivity('api_success', keyId, { provider:providerId, model });
    if(typeof onKeyUsed==='function') onKeyUsed(keyId, true);
    return { ok:true, status, text, promptTokens:pt, completionTokens:ct, totalTokens:tt, latency:+latency.toFixed(2) };
  }else{
    addUsageLog({ provider:providerId, keyId, model, endpoint, status:'failed', latency:+latency.toFixed(2), promptTokens:0, completionTokens:0, totalTokens:0 });
    addActivity('api_failed', keyId, { provider:providerId, status });
    if(typeof onKeyUsed==='function') onKeyUsed(keyId, false);
    const detail = (data && (data.error?.message || data.message)) || respText.slice(0,200) || ('HTTP '+status);
    return { ok:false, error:'http', status, message: detail, latency:+latency.toFixed(2) };
  }
}

/** 仅验证 Key 是否有效（可选，用于 “Test Key”） */
async function testApiKey({ providerId, keyId, endpoint }){
  return sendPlaygroundRequest({ providerId, keyId, endpoint, model:null, systemPrompt:'', userPrompt:'ping' });
}
