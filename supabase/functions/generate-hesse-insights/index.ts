
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, concepts } = await req.json();

    console.log('Generating insights for session:', sessionId);
    console.log('Concepts count:', concepts.length);

    // Generate conceptual insights
    const conceptualPrompt = `You are Hermann Hesse writing about the Glass Bead Game. Based on these concepts and their relationships, write a short paragraph (60-80 words) about the conceptual synthesis:

Concepts: ${concepts.map((c: any) => `${c.text} (${c.discipline})`).join(', ')}

Write in Hesse's contemplative style about how these concepts relate to each other intellectually and spiritually. Focus on the connections between ideas across disciplines.`;

    // Generate dimensional insights
    const dimensionalPrompt = `You are Hermann Hesse reflecting on the Glass Bead Game's dimensional space. Based on these concepts positioned in 3D space, write a longer paragraph (120-150 words) about dimensional expressions and collective symbiosis:

Concepts with positions: ${concepts.map((c: any) => 
      `${c.text} at (${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)})`
    ).join(', ')}

Write in Hesse's mystical style about how the spatial arrangement creates meaning, how proximity and distance in the dimensional space reflect deeper truths about knowledge and understanding. Discuss the collective symbiosis of ideas in this sacred geometry.`;

    // Generate both texts in parallel
    const [conceptualResponse, dimensionalResponse] = await Promise.all([
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: conceptualPrompt }],
          max_tokens: 150,
          temperature: 0.8,
        }),
      }),
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: dimensionalPrompt }],
          max_tokens: 250,
          temperature: 0.8,
        }),
      })
    ]);

    const conceptualData = await conceptualResponse.json();
    const dimensionalData = await dimensionalResponse.json();

    const conceptualText = conceptualData.choices[0].message.content;
    const dimensionalText = dimensionalData.choices[0].message.content;

    // Store the insights in the database
    const { data: insight, error } = await supabase
      .from('text_insights')
      .insert({
        session_id: sessionId,
        conceptual_text: conceptualText,
        dimensional_text: dimensionalText,
        concept_positions: concepts.map((c: any) => ({
          id: c.id,
          text: c.text,
          discipline: c.discipline,
          x: c.x,
          y: c.y,
          z: c.z,
          energy: c.energy
        }))
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing insight:', error);
      throw error;
    }

    console.log('Generated and stored insight:', insight.id);

    return new Response(JSON.stringify({
      conceptualText,
      dimensionalText,
      insightId: insight.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-hesse-insights function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to generate Hesse-style insights'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
