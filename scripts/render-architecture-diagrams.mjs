import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'docs', 'diagrams');
const colors = {
  ink: '#15283F',
  muted: '#53657B',
  line: '#8A9BB0',
  background: '#F5F7FB',
  blue: '#245BC7',
  blueLight: '#EAF1FF',
  purple: '#7550B0',
  purpleLight: '#F2EDFA',
  teal: '#007C78',
  tealLight: '#E5F5F2',
  amber: '#A15D0B',
  amberLight: '#FFF3DF',
};

const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function text(x, y, value, size = 19, fill = colors.muted, weight = 400) {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${escape(value)}</text>`;
}

function lines(x, y, values, size = 19, fill = colors.muted, gap = 29) {
  return values
    .map((value, i) => text(x, y + i * gap, value, size, fill))
    .join('');
}

function rect(x, y, width, height, fill, stroke = '#DCE3ED', radius = 16) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
}

function card(x, y, width, height, title, body, tone = 'blue', size = 19) {
  return (
    rect(x, y, width, height, colors[`${tone}Light`], colors[tone]) +
    `<rect x="${x}" y="${y + 18}" width="5" height="${height - 36}" rx="2" fill="${colors[tone]}"/>` +
    text(x + 24, y + 37, title, 23, colors.ink, 650) +
    lines(x + 24, y + 73, body, size)
  );
}

function arrow(points, dashed = false, color = colors.line) {
  return `<polyline points="${points.map((point) => point.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" ${dashed ? 'stroke-dasharray="8 7"' : ''} marker-end="url(#arrow)"/>`;
}

function base(name, title, subtitle, height, body) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${height}" viewBox="0 0 1600 ${height}" role="img" aria-labelledby="title description">
<title id="title">${escape(title)}</title>
<desc id="description">${escape(subtitle)}</desc>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${colors.line}"/></marker></defs>
<g font-family="Segoe UI, Arial, sans-serif">
<rect width="1600" height="${height}" fill="#FFFFFF"/>
<rect x="0" y="0" width="1600" height="9" fill="${colors.blue}"/>
${text(55, 66, title, 36, colors.ink, 700)}
${text(55, 104, subtitle, 20)}
${body}
${text(55, height - 25, 'BACKEND CHALLENGE  /  Documentação da implementação atual', 15)}
${text(1450, height - 25, name.slice(0, 2), 15, colors.muted, 600)}
</g></svg>
`;
  return { name, height, svg };
}

function overview() {
  return base(
    '01-runtime-overview',
    'Arquitetura em execução',
    'Uma API modular em NestJS, com persistência no DynamoDB e limites de requisição no Redis.',
    1100,
    rect(355, 160, 800, 730, colors.background) +
      text(385, 200, 'API  /  NestJS + Express', 24, colors.ink, 650) +
      card(55, 350, 245, 170, 'Cliente HTTP', [
        'Swagger /api',
        'ou consumidor da API',
        'JSON + bearer token',
      ]) +
      card(
        390,
        230,
        730,
        115,
        'Entrada HTTP e proteções compartilhadas',
        ['Request ID · métricas HTTP · limite por IP · validação por rota'],
        'blue',
        18,
      ) +
      card(
        390,
        405,
        225,
        175,
        'AuthModule',
        ['POST /v1/auth/login', 'Verifica credenciais', 'Emite JWT'],
        'purple',
        17,
      ) +
      card(
        635,
        405,
        225,
        175,
        'UsersModule',
        ['POST /v1/users', 'Cadastro público', 'Atribui papel USER'],
        'purple',
        17,
      ) +
      card(
        880,
        405,
        240,
        175,
        'ProductsModule',
        ['GET e POST', '/v1/products', 'JWT; criação: ADMIN'],
        'purple',
        17,
      ) +
      card(
        1220,
        230,
        325,
        145,
        'Redis',
        ['Contadores de rate limit', 'Compartilhados entre instâncias'],
        'amber',
        18,
      ) +
      card(
        1220,
        470,
        325,
        205,
        'DynamoDB',
        [
          'Users: chave email',
          'Products: chave id',
          '3 índices por status + ordem',
          'Leitura e escrita por adapters',
        ],
        'amber',
        18,
      ) +
      card(
        390,
        685,
        730,
        165,
        'Actuator, logs e tratamento de erros',
        [
          'Health público: liveness da API',
          'Métricas Prometheus: bearer token próprio',
          'Logs JSON e erros HTTP correlacionados por requestId',
        ],
        'teal',
        19,
      ) +
      arrow([
        [300, 435],
        [330, 435],
        [330, 287],
        [390, 287],
      ]) +
      text(65, 324, 'Requisições HTTP', 19, colors.blue, 600) +
      arrow([
        [1120, 287],
        [1220, 287],
      ]) +
      arrow([
        [755, 345],
        [755, 375],
        [502, 375],
        [502, 405],
      ]) +
      arrow([
        [755, 375],
        [747, 375],
        [747, 405],
      ]) +
      arrow([
        [755, 375],
        [1000, 375],
        [1000, 405],
      ]) +
      arrow([
        [502, 580],
        [502, 620],
        [1175, 620],
        [1175, 565],
        [1220, 565],
      ]) +
      `<path d="M747 580 V620 M1000 580 V620" fill="none" stroke="${colors.line}" stroke-width="2.5"/>` +
      text(640, 651, 'Ports de aplicação → adapters → AWS SDK', 18) +
      rect(55, 935, 1490, 95, colors.background) +
      text(80, 970, 'AMBIENTE LOCAL', 17, colors.blue, 700) +
      text(
        80,
        1003,
        'API no host (:3000) · Docker Compose: Redis (:6379) e DynamoDB Local (:8000).',
        21,
      ),
  );
}

function sequenceArrow(from, to, y, label, dashed = false) {
  const width = label.length * 9.6 + 22;
  const center = (from + to) / 2;
  return (
    arrow(
      [
        [from, y],
        [to, y],
      ],
      dashed,
    ) +
    `<rect x="${center - width / 2}" y="${y - 29}" width="${width}" height="25" rx="6" fill="#FFFFFF"/>` +
    `<text x="${center}" y="${y - 10}" text-anchor="middle" font-size="18" font-weight="500" fill="${colors.ink}">${escape(label)}</text>`
  );
}

function authentication() {
  const lanes = [170, 550, 940, 1360];
  const headers = [
    ['Cliente', 'HTTP / JSON'],
    ['Entrada HTTP', 'Controllers, Zod e rate limit'],
    ['Aplicação', 'CreateUserService / AuthService'],
    ['Infraestrutura', 'Argon2id, DynamoDB e JWT'],
  ];
  let body = headers
    .map(([title, detail], index) => {
      const x = lanes[index];
      return (
        rect(x - 145, 155, 290, 88, colors.background) +
        text(x - 120, 190, title, 23, colors.ink, 650) +
        text(x - 120, 221, detail, 16) +
        `<line x1="${x}" y1="250" x2="${x}" y2="1040" stroke="#CFD8E5" stroke-width="2" stroke-dasharray="7 8"/>`
      );
    })
    .join('');

  body +=
    rect(55, 268, 1490, 43, colors.blueLight, colors.blue, 9) +
    text(76, 297, '01  CADASTRO PÚBLICO', 19, colors.blue, 700) +
    sequenceArrow(170, 550, 350, 'POST /v1/users') +
    sequenceArrow(550, 940, 400, 'Validar dados → execute()') +
    sequenceArrow(940, 1360, 450, 'Hash Argon2id + gravação condicional') +
    sequenceArrow(
      1360,
      940,
      505,
      'Operação concluída; existência não exposta',
      true,
    ) +
    sequenceArrow(
      940,
      170,
      560,
      'HTTP 200 · mesma mensagem genérica · sem hash ou token',
      true,
    ) +
    rect(55, 605, 1490, 43, colors.purpleLight, colors.purple, 9) +
    text(76, 634, '02  LOGIN E USO DO TOKEN', 19, colors.purple, 700) +
    sequenceArrow(170, 550, 690, 'POST /v1/auth/login') +
    sequenceArrow(550, 940, 740, 'Validar dados → login()') +
    sequenceArrow(940, 1360, 790, 'Buscar email no DynamoDB; verificar hash') +
    sequenceArrow(940, 1360, 845, 'Credenciais válidas → assinar JWT HS256') +
    sequenceArrow(1360, 940, 900, 'accessToken + expiresIn', true) +
    sequenceArrow(
      940,
      170,
      955,
      'HTTP 200 · accessToken, tokenType e expiresIn',
      true,
    ) +
    sequenceArrow(170, 550, 1015, 'Bearer JWT → /v1/products') +
    rect(55, 1070, 730, 125, colors.background) +
    lines(
      80,
      1107,
      [
        'Validação inválida → 400; credenciais inválidas → 401.',
        'Email inexistente também verifica um hash substituto.',
        'Cadastro não substitui uma conta que já existe.',
      ],
      19,
    ) +
    rect(815, 1070, 730, 125, colors.background) +
    lines(
      840,
      1107,
      [
        'JwtStrategy valida assinatura e expiração localmente.',
        'A autenticação da requisição não consulta Users.',
        'Criar produto exige ADMIN; cadastro público gera USER.',
      ],
      19,
    );

  return base(
    '03-registration-and-login',
    'Cadastro, autenticação e autorização',
    'Fluxos resumidos de sucesso; os detalhes de proteção e as saídas de erro estão indicados abaixo.',
    1250,
    body,
  );
}

function findBrowser() {
  if (process.env.DIAGRAM_BROWSER) {
    return process.env.DIAGRAM_BROWSER;
  }

  const candidates =
    process.platform === 'win32'
      ? [
          join(
            process.env['PROGRAMFILES(X86)'] ?? 'C:/Program Files (x86)',
            'Microsoft/Edge/Application/msedge.exe',
          ),
          join(
            process.env.PROGRAMFILES ?? 'C:/Program Files',
            'Google/Chrome/Application/chrome.exe',
          ),
          join(
            process.env.PROGRAMFILES ?? 'C:/Program Files',
            'Microsoft/Edge/Application/msedge.exe',
          ),
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          ]
        : [
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/google-chrome',
            '/opt/google/chrome/chrome',
          ];

  const browser = candidates.find((candidate) => existsSync(candidate));
  if (!browser) {
    throw new Error(
      'Para gerar PNG, instale Chrome/Chromium/Edge ou defina DIAGRAM_BROWSER com o caminho do executável. Os SVGs já foram gerados.',
    );
  }
  return browser;
}

function renderPng(browser, diagram) {
  const profile = join(
    root,
    '.tmp',
    'architecture-diagrams',
    'browser-profile',
  );
  mkdirSync(profile, { recursive: true });
  const pngPath = join(output, `${diagram.name}.png`);
  const result = spawnSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-background-networking',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--user-data-dir=${profile}`,
      `--window-size=1600,${diagram.height}`,
      `--screenshot=${pngPath}`,
      pathToFileURL(join(output, `${diagram.name}.svg`)).href,
    ],
    { encoding: 'utf8', timeout: 30_000 },
  );

  if (result.error || result.status !== 0) {
    throw new Error(
      `Falha ao renderizar ${diagram.name}: ${result.error?.message ?? result.stderr}`,
    );
  }

  const image = readFileSync(pngPath);
  if (
    image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    image.readUInt32BE(16) !== 1600 ||
    image.readUInt32BE(20) !== diagram.height
  ) {
    throw new Error(`PNG inválido ou dimensões inesperadas: ${diagram.name}`);
  }
}

mkdirSync(output, { recursive: true });
const diagrams = [overview(), authentication()];
for (const diagram of diagrams) {
  writeFileSync(join(output, `${diagram.name}.svg`), diagram.svg, 'utf8');
  console.log(`SVG: docs/diagrams/${diagram.name}.svg`);
}
if (process.argv.includes('--png')) {
  const browser = findBrowser();
  for (const diagram of diagrams) {
    renderPng(browser, diagram);
    console.log(`PNG: docs/diagrams/${diagram.name}.png`);
  }
}
