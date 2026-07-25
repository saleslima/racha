# Racha Cuca

PWA de quebra-cabeça feita somente com HTML, CSS e JavaScript.

Criado por Marcio Sales Lima.

## Recursos
- Upload de imagem por arquivo, sem abertura da câmera.
- Fácil: 10 peças.
- Médio: 30 peças.
- Avançado: 60 peças.
- Peças com recortes de quebra-cabeça.
- Arraste por mouse ou toque.
- Borda/sombra verde no encaixe correto.
- Borda/sombra vermelha na posição incorreta.
- Contador de progresso, tentativas e tempo.
- Instalação como PWA e funcionamento offline.

## Executar
A PWA deve ser servida por HTTP para que o Service Worker funcione.

Exemplos:

```bash
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

No Laragon, copie a pasta para `C:\\laragon\\www` e abra pelo domínio local criado.


## Mobile e offline
A interface é responsiva para celulares e tablets. Após a primeira abertura online, os arquivos principais ficam em cache e a PWA pode ser reaberta sem internet. No GitHub Pages, aguarde a primeira carga completa antes de testar o modo avião.

## Atualização
- Corrigido o desaparecimento das peças durante o arraste em telas touch.
- Adicionada opção para exibir ou ocultar a imagem-gabarito por baixo do tabuleiro.
