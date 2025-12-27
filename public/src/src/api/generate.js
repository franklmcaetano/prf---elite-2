/* CAMINHO: /api/generate.js
   Este código NÃO precisa de alterações.
   Ele apenas lê a chave que você configurar no painel da Vercel.
*/

export default async function handler(req, res) {
  // 1. Configurar permissões (CORS) para o seu site funcionar
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Responder a verificações do navegador (Pre-flight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Pegar a chave do "Cofre" da Vercel
  // Você configura esta chave no site da Vercel, não aqui no código.
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Chave API não configurada no servidor Vercel.' });
  }

  try {
    // 3. O servidor conversa com o Google (Seguro)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      }
    );

    const data = await response.json();
    
    // 4. Devolve a resposta para o seu site
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao comunicar com a Inteligência Artificial.' });
  }
}
