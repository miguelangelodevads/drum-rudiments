# 🥁 Drum Studio

### Aplicação web para praticar rudimentos de bateria

Projeto que conecta minha experiência como baterista ao
desenvolvimento de software, reunindo acompanhamento visual,
metrônomo e reprodução de exercícios no navegador.

## Funcionalidades

- Seleção de rudimentos e filtro por categoria.
- Visualização das mãos direita (R), esquerda (L) e pausas.
- Destaque visual do toque durante a reprodução.
- Controle de andamento entre 40 e 400 BPM.
- Seleção de subdivisões rítmicas.
- Reprodução, pausa e controle de som.
- Metrônomo e sons sintetizados no navegador.
- Interface adaptada para celular e computador.
- Orientações para instalação como aplicativo.
- Manutenção da tela ativa durante o treino, quando suportada.

## Tecnologias

| Tecnologia | Aplicação |
| --- | --- |
| React | Interface e gerenciamento de estado |
| JavaScript | Lógica dos exercícios e controles |
| Web Audio API | Síntese sonora e agendamento do áudio |
| Vite | Desenvolvimento e build |
| Lucide React | Ícones |
| Vite PWA Plugin | Configuração de PWA |

## Decisões técnicas

O áudio utiliza o relógio da Web Audio API para programar
os sons com antecedência. O acompanhamento visual destaca
a sequência dos toques durante a execução.

A disponibilidade de áudio, instalação e manutenção da
tela ativa depende do navegador e das permissões concedidas.

## Executar localmente

Com Node.js e npm instalados:

~~~sh
git clone https://github.com/miguelangelodevads/drum-rudiments.git
cd drum-rudiments
npm install
npm run dev
~~~

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Iniciar o ambiente de desenvolvimento |
| `npm run lint` | Executar análise estática |
| `npm run build` | Gerar a versão de produção |
| `npm run preview` | Visualizar o build localmente |

## Organização

- `src/App.jsx`: interface, controles e lógica de áudio.
- `src/index.css`: estilos.
- `package.json`: dependências e comandos.

## Estado do projeto

Projeto de portfólio em evolução. Compatibilidade e
comportamento podem variar entre navegadores.

## Autor

**Miguel Angelo — músico e desenvolvedor de software júnior.**

[Conheça meu portfólio](https://miguel-angelo-portifolio.vercel.app/)
