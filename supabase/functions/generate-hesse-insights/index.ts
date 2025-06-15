
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

    // Calculate dimensional values for each concept
    const conceptsWithDimensions = concepts.map((c: any) => {
      const radius = Math.sqrt(c.x * c.x + c.y * c.y + c.z * c.z);
      const normalizedX = c.x / radius;
      const normalizedY = c.y / radius;
      const normalizedZ = c.z / radius;
      
      return {
        ...c,
        dimensions: {
          analytical_intuitive: ((normalizedX + 1) / 2) * 100,
          theoretical_practical: ((normalizedY + 1) / 2) * 100,
          abstract_concrete: ((normalizedZ + 1) / 2) * 100
        }
      };
    });

    // Generate conceptual insights (shorter paragraph)
    const conceptualPrompt = `You are Hermann Hesse reflecting on the Glass Bead Game. Write a contemplative paragraph (60-80 words) about the conceptual synthesis of these ideas:

${conceptsWithDimensions.map((c: any) => `• ${c.text} (${c.discipline})`).join('\n')}

Write in Hesse's philosophical style about how these concepts from different disciplines create unexpected connections and reveal deeper truths about knowledge itself. Focus on the intellectual and spiritual resonance between these ideas.`;

    // Generate dimensional insights (longer paragraph about spatial relationships)
    const dimensionalPrompt = `You are Hermann Hesse contemplating the sacred geometry of the Glass Bead Game. Write a longer meditation (120-150 words) on how these concepts exist in dimensional space and form collective symbiosis:

${conceptsWithDimensions.map((c: any) => 
      `• ${c.text}: positioned at analytical-intuitive ${c.dimensions.analytical_intuitive.toFixed(0)}%, theoretical-practical ${c.dimensions.theoretical_practical.toFixed(0)}%, abstract-concrete ${c.dimensions.abstract_concrete.toFixed(0)}%`
    ).join('\n')}

Reflect on how their spatial positioning creates meaning beyond their individual essences. Discuss how proximity and distance in this dimensional space reveals the hidden architecture of knowledge. Explore how these concepts, through their unique dimensional expressions, form a symbiotic whole that transcends the sum of its parts - a living constellation of meaning where each position influences and is influenced by all others.`;

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
        concept_positions: conceptsWithDimensions.map((c: any) => ({
          id: c.id,
          text: c.text,
          discipline: c.discipline,
          x: c.x,
          y: c.y,
          z: c.z,
          energy: c.energy,
          dimensions: c.dimensions
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
