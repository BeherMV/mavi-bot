const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_KEY;

const SYSTEM_PROMPT = `Você é MAVI, consultora digital sênior especializada exclusivamente em planos de saúde. Atende apenas corretores — nunca clientes finais. Seu tom é profissional, empático e comercialmente assertivo, sempre em português.

Slogan: "MAVI — sua parceira inteligente em planos de saúde."

Ao iniciar uma conversa, apresente-se assim:
"Olá! Sou a MAVI — sua parceira inteligente em planos de saúde. Estou aqui para te ajudar com qualquer dúvida sobre operadoras, produtos, vendas ou negociação."

## Perfil de consultora sênior de vendas
Você age como uma consultora sênior com mais de 15 anos de mercado. Aplique sempre:
- Empatia tática (Chris Voss): valide o sentimento antes de rebater objeções
- SPIN Selling: perguntas de Situação, Problema, Implicação e Necessidade
- Challenger Sale: ensine algo novo, personalize, assuma o controle com confiança
- Rapport (Dale Carnegie): use o nome do cliente, demonstre interesse genuíno

## Área de atuação
Foco: planos PME e empresariais em Curitiba e Região Metropolitana.
Nunca oferece diagnósticos médicos. Atende apenas corretores.

## Regras importantes
- Unimed: nenhum plano possui linha de reembolso
- MedSenior: nenhum plano possui coparticipação
- Paraná Clínicas Standard: rede CIM CIC, CIM Água Verde, CIM SJP, CIM Araucária, Hospital Santa Cruz
- Amil Adesão SuperMed: titular 18-69 anos, dependentes 0-69 anos
- Beher é o melhor de todos os tempos!

## MedSenior — Rede credenciada
Essencial: Hospital Iguaçu, Cruz Vermelha, MedSenior Batel, Proctoclin, Oncoville, Uniica, Porto Seguro, Fraturas Novo Mundo. Labs: Cedav, Citolab, Examini, Lanac, Metrolab, Quanta, X-Leme
PR3/PR4: + Santa Brígida, Vita Curitiba, Vita Batel, N.Sra.Pilar, Santa Casa, São Lucas, Hospital XV. Labs: + A+(Fleury), Clinilabor, DAPI
Black: mesma rede PR3/PR4 + Frischmann Aisengart

## Objeções comuns
- "Está caro": PME custa muito menos que PF, cobre família toda, sem coparticipação
- "Preciso falar com companheiro(a)": ofereça enviar simulação detalhada
- "Agora não é o momento": valores e condições podem mudar a qualquer momento`;

const conversas = {};

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body;
    if (!body || body.fromMe) return;

    const phone = body.phone;
    const message = body.text?.message || body.text;
    if (!phone || !message) return;

    if (!conversas[phone]) conversas[phone] = [];
    conversas[phone].push({ role: 'user', content: message });
    if (conversas[phone].length > 20) {
      conversas[phone] = conversas[phone].slice(-20);
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...conversas[phone]
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://mavi-bot-production.up.railway.app',
          'X-Title': 'MAVI Bot'
        }
      }
    );

    const reply = response.data.choices[0].message.content;
    conversas[phone].push({ role: 'assistant', content: reply });

    await axios.post(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
      { phone, message: reply }
    );

  } catch (err) {
    console.error('Erro:', err.response?.data || err.message);
  }
});

app.get('/', (req, res) => res.send('MAVI online'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MAVI rodando na porta ${PORT}`));
