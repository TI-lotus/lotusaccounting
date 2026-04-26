const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const LIA_WEBHOOK_URL = 'https://n8n.lotuscont.com.br/webhook/32332bc6-9921-4572-9f18-f876f5419730'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => null)
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const history = Array.isArray(body?.history) ? body.history : []

    if (!message) {
      return new Response(JSON.stringify({ error: 'Mensagem obrigatória' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch(LIA_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, source: 'lotus-app' }),
    })

    const text = await response.text()
    let data: unknown = text
    try {
      data = JSON.parse(text)
    } catch (_) {
      data = text
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Webhook da Lia retornou erro', details: data }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const reply =
      typeof data === 'string'
        ? data
        : (data as Record<string, unknown>)?.reply ??
          (data as Record<string, unknown>)?.response ??
          (data as Record<string, unknown>)?.message ??
          (data as Record<string, unknown>)?.output ??
          'Recebi sua mensagem e já processei com a Lia.'

    return new Response(JSON.stringify({ reply, raw: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
