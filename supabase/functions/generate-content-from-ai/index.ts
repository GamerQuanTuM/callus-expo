// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { PromptTemplate } from 'npm:@langchain/core/prompts'
import { StringOutputParser } from 'npm:@langchain/core/output_parsers'
import { ChatGoogleGenerativeAI } from "npm:@langchain/google-genai"
import { RunnableSequence } from 'npm:@langchain/core/runnables'

//supabase functions deploy generate-content-from-ai
const gemini_api_key = Deno.env.get("GEMINI_API_KEY")

// CORS headers for web requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, type } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // Initialize the model
    const model = new ChatGoogleGenerativeAI({
      apiKey: gemini_api_key,
      model: "gemini-2.5-flash"
    })

    // Create template based on type
    const template = type === "title" ? `Create a catchy, engaging title within 100 characters with no new line character(|\n|) for: {topic}` : `Create a compelling description within 500 characters with no new line character(|\n|) for: {topic}`;

    const promptTemplate = PromptTemplate.fromTemplate(template)

    const chain = RunnableSequence.from([
      promptTemplate,
      model,
      new StringOutputParser()
    ])

    // Invoke the chain
    const result = await chain.invoke({ topic: prompt })

    return new Response(
      JSON.stringify({
        success: true,
        result: result,
        type: type
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )

  } catch (error) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        //@ts-ignore
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})