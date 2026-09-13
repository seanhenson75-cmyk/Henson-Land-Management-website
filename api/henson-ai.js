export default async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({error:'method_not_allowed'});
  }

  if(!process.env.GROQ_API_KEY){
    return res.status(503).json({
      error:'groq_not_configured',
      message:'Henson AI cloud access is not configured yet.'
    });
  }

  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const rawMessages=Array.isArray(body.messages)?body.messages:[];
    const messages=rawMessages
      .filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string')
      .slice(-20)
      .map(m=>({role:m.role,content:m.content.slice(0,12000)}));

    if(!messages.length||messages[messages.length-1].role!=='user'){
      return res.status(400).json({error:'invalid_messages'});
    }

    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45000);

    let upstream;
    try{
      upstream=await fetch('https://api.groq.com/openai/v1/chat/completions',{
        method:'POST',
        headers:{
          'Authorization':`Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type':'application/json'
        },
        body:JSON.stringify({
          model:'openai/gpt-oss-120b',
          messages:[
            {role:'system',content:'You are Henson AI, a practical, intelligent general-purpose assistant. Give accurate, useful answers. Think carefully, be direct, and say when you are uncertain. Do not reveal hidden chain-of-thought.'},
            ...messages
          ],
          reasoning_effort:'high',
          include_reasoning:false,
          temperature:0.5,
          max_completion_tokens:3500,
          stream:false
        }),
        signal:controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    const remaining=upstream.headers.get('x-ratelimit-remaining-requests');
    const reset=upstream.headers.get('x-ratelimit-reset-requests');

    if(upstream.status===429){
      return res.status(429).json({
        error:'free_limit_reached',
        message:'The free cloud AI limit has been reached. Henson AI stopped instead of using paid capacity.',
        retry_after:upstream.headers.get('retry-after')||null,
        reset:reset||null
      });
    }

    if(!upstream.ok){
      const detail=await upstream.text().catch(()=> '');
      console.error('Groq error',upstream.status,detail.slice(0,500));
      return res.status(503).json({
        error:'cloud_unavailable',
        message:'The free cloud AI is unavailable right now. No paid fallback was used.'
      });
    }

    const data=await upstream.json();
    const answer=data?.choices?.[0]?.message?.content?.trim();
    if(!answer){
      return res.status(502).json({error:'empty_response',message:'The cloud AI returned no answer.'});
    }

    return res.status(200).json({
      answer,
      model:'openai/gpt-oss-120b',
      free_only:true,
      remaining_requests:remaining,
      reset:reset
    });
  }catch(err){
    if(err?.name==='AbortError'){
      return res.status(504).json({error:'timeout',message:'The free cloud AI took too long to respond. Try again.'});
    }
    console.error('Henson AI error',err);
    return res.status(500).json({error:'server_error',message:'Henson AI could not reach the free cloud AI. No paid fallback was used.'});
  }
}
