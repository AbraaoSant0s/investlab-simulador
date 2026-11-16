# InvestLab

Site estático para GitHub Pages. Não inclui servidor, banco de dados ou token.

## Publicação

Envie `index.html` e `trabalho.js` para a raiz do repositório. Em **Settings → Pages**, selecione **Deploy from a branch**, escolha a branch `main` e a pasta `/ (root)`.

## Acesso e armazenamento

O cadastro usa apenas ID e senha. As credenciais e simulações ficam neste navegador; não são sincronizadas nem enviadas a um servidor. O hash PBKDF2 é apenas uma proteção local demonstrativa. Não use senha importante: o site não fornece autenticação segura para dados reais.

Chart.js, Tailwind CSS e as cotações CoinGecko são carregados pela internet. O simulador continua disponível se as cotações falharem.
