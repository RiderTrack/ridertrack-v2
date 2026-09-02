// ═══════════════════════════════════════════════════════════
// 🗂️ CATÁLOGO DE PODCASTS POR CATEGORÍA (Fase 3.45)
//
// Lo que pediste: "categorías para escoger y ampliar la
// biblioteca — novelas antiguas, ciencia ficción, terror".
//
//   · 7 categorías curadas con 34 feeds VERIFICADOS uno por
//     uno el 3 de setiembre de 2026 (HTTP 200 + XML + audio):
//     si un feed murió ese día, no entró al catálogo.
//   · Cada categoría además trae un "término" vivo: al abrirla
//     se busca en iTunes lo más escuchado de ese género —
//     la biblioteca se amplia sola, siempre fresca.
//   · Archivo 100% puro (0 imports) → testeable en Node.
//
// La lógica de reproducción/descarga NO vive aquí: sigue en
// services/podcastRSS.ts + utils/podcastRssCore.ts.
// ═══════════════════════════════════════════════════════════

export interface FeedCurado {
  /** nombre del podcast (tal como se ve en su feed) */
  titulo: string;
  /** URL del RSS — verificada viva */
  url: string;
  /** descripción corta para el usuario */
  nota: string;
  /** episodios al momento de verificar (orientativo) */
  eps: number;
  /** portada (sale del propio feed; si falla, emoji de la categoría) */
  imagen?: string;
  /** inglés = se marca en la fila para que no sorprenda */
  idioma?: 'es' | 'en';
}

export interface CategoriaPodcast {
  id: string;
  emoji: string;
  nombre: string;
  descripcion: string;
  /** término para la búsqueda en vivo (iTunes) al abrir la categoría */
  termino: string;
  /** feeds curados y verificados */
  feeds: FeedCurado[];
}

/** Fecha en la que se verificó cada feed de este catálogo (vivos, con audio) */
export const FECHA_VERIFICACION_CATALOGO = '2026-09-03';

export const CATEGORIAS_PODCAST: CategoriaPodcast[] = [
  {
    id: 'novelas',
    emoji: '📖',
    nombre: 'Novelas y audiolibros',
    descripcion: 'Novelas y libros completos narrados — para tus escuchas largas en la ruta.',
    termino: 'audiolibro',
    feeds: [
      {
        titulo: 'Audiolibros, cuentos y relatos (Libreta de Lecturas)',
        url: 'https://www.spreaker.com/show/6467032/episodes/feed',
        nota: 'Un espacio para sumergirte en una buena historia: novelas, cuentos y relatos.',
        eps: 29,
        imagen: 'https://d3wo5wojvuv7l.cloudfront.net/t_rss_itunes_square_1400/images.spreaker.com/original/9cf4319b611a3528d571d90115547fbc.jpg',
      },
      {
        titulo: 'La Odisea — Audiolibro narrado',
        url: 'https://anchor.fm/s/11554a2ac/podcast/rss',
        nota: 'Homero completo, con la clásica traducción española de 1910.',
        eps: 24,
        imagen: 'https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/46428355/46428355-1785035375604-a10ca23635a8f.jpg',
      },
      {
        titulo: 'Relatos de terror, ciencia ficción, misterio…',
        url: 'https://feeds.ivoox.com/feed_fg_f1606550_filtro_1.xml',
        nota: 'Audiolibros de todo un poco: terror, ciencia ficción y misterio narrados.',
        eps: 39,
        imagen: 'https://static-1.ivoox.com/canales/e/1/e/4/e1e4c0904e2ad0e3ac3f4b9915acdc36_XXL.jpg',
      },
    ],
  },
  {
    id: 'clasicos',
    emoji: '🏛️',
    nombre: 'Clásicos y novelas antiguas',
    descripcion: 'Las novelas de toda la vida, leídas en voz alta — Frankenstein, Austen, Homero…',
    termino: 'libros clasicos audiolibro',
    feeds: [
      {
        titulo: 'Orgullo y prejuicio — Audiolibro completo',
        url: 'https://www.spreaker.com/show/5702947/episodes/feed',
        nota: 'Jane Austen: la novela completa, narrada.',
        eps: 11,
        imagen: 'https://d3wo5wojvuv7l.cloudfront.net/t_rss_itunes_square_1400/images.spreaker.com/original/dafd05682948633bc13bfd871be01d10.jpg',
      },
      {
        titulo: 'La Vorágine — Audiolibro por capítulos',
        url: 'https://www.spreaker.com/show/6685962/episodes/feed',
        nota: 'La novela clásica de la selva colombiana, de José Eustasio Rivera.',
        eps: 19,
        imagen: 'https://d3wo5wojvuv7l.cloudfront.net/t_rss_itunes_square_1400/images.spreaker.com/original/00ea7d8871c34d0d2d0cd2151403e0c7.jpg',
      },
      {
        titulo: 'CantoBooks — Audiolibros clásicos (Español)',
        url: 'https://cantobooks.com/podcast/es.xml',
        nota: 'Clásicos narrados: Edith Wharton, Dickens y más, capítulo a capítulo.',
        eps: 34,
        imagen: 'https://cantobooks.com/static/podcast-cover-es.jpg',
      },
      {
        titulo: 'La «Odisea» de Homero: audiolibro',
        url: 'https://www.spreaker.com/show/5275008/episodes/feed',
        nota: 'Otra narración completa de la Odisea, estilo radio.',
        eps: 10,
        imagen: 'https://d3wo5wojvuv7l.cloudfront.net/t_rss_itunes_square_1400/images.spreaker.com/original/fccbf7a7e4c0d08d1d90f2bec5506a5f.jpg',
      },
      {
        titulo: 'Frankenstein — Audiolibro',
        url: 'https://feeds.ivoox.com/feed_fg_f1707033_filtro_1.xml',
        nota: 'Mary Shelley, o el moderno Prometeo. Narración de Francisco Fernández.',
        eps: 36,
        imagen: 'https://static-2.ivoox.com/canales/3/4/5/e/345ea8962ce15d85f967b6e8fbc6622e_XXL.jpg',
      },
      {
        titulo: 'LibriVox — Relatos y cuentos',
        url: 'https://librivox.org/rss/4182',
        nota: 'La biblioteca libre: relatos clásicos leídos por voluntarios.',
        eps: 12,
        imagen: 'https://archive.org/download/LibrivoxCdCoverArt19/Relatos_Cuentos_Vol002_1209.jpg',
      },
    ],
  },
  {
    id: 'cificcion',
    emoji: '🚀',
    nombre: 'Ciencia ficción',
    descripcion: 'Relatos y novelas de ciencia ficción — los clásicos y lo nuevo, en audio.',
    termino: 'ciencia ficcion',
    feeds: [
      {
        titulo: 'Podcast de Leyendo Ciencia Ficción',
        url: 'https://feeds.feedburner.com/leyendo-ciencia-ficcion',
        nota: 'Comentan y recomiendan literatura de ciencia ficción de cualquier época.',
        eps: 38,
        imagen: 'https://static-1.ivoox.com/canales/2/2/1/3/7331483443122_XXL.jpg',
      },
      {
        titulo: 'Podcast Lab 137 — Cuentos y novelas de cf',
        url: 'https://www.spreaker.com/show/6493228/episodes/feed',
        nota: 'Cuentos y novelas de ciencia ficción narrados, con sus autores.',
        eps: 52,
        imagen: 'https://d3wo5wojvuv7l.cloudfront.net/t_rss_itunes_square_1400/images.spreaker.com/original/4971273313643dfdd6ccc27a87d28254.jpg',
      },
      {
        titulo: 'La Tierra Perdida — cf épica en audio',
        url: 'https://feeds.ivoox.com/feed_fg_f11098716_filtro_1.xml',
        nota: 'Novela de ciencia ficción épica narrada por capítulos.',
        eps: 28,
        imagen: 'https://static-1.ivoox.com/canales/4/f/4/b/4f4b1b5bb3d083c41fd195dc81f03f62_XXL.jpg',
      },
      {
        titulo: 'Frecuencia Perdida — Suspenso y cf',
        url: 'https://anchor.fm/s/10ff57174/podcast/rss',
        nota: 'Relatos cortos de suspenso, thriller y ciencia ficción.',
        eps: 29,
        imagen: 'https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/45527109/45527109-1773046717367-37143007b688a.jpg',
      },
      {
        titulo: 'Clásicos de ciencia ficción',
        url: 'https://anchor.fm/s/4f516d10/podcast/rss',
        nota: 'Lecturas cortas de los mejores clásicos del género.',
        eps: 5,
        imagen: 'https://d3t3ozftmdmh3i.cloudfront.net/production/podcast_uploaded/13207364/13207364-1614665178255-a341635c8b819.jpg',
      },
      {
        titulo: 'Escape Pod (inglés)',
        url: 'https://escapepod.org/feed/',
        nota: 'El legendario podcast de ciencia ficción semanal, en inglés.',
        eps: 100,
        idioma: 'en',
        imagen: 'https://escapepod.org/wp-content/uploads/2018/03/cropped-Escape-Pod-chip-2-32x32.png',
      },
    ],
  },
  {
    id: 'terror',
    emoji: '👻',
    nombre: 'Terror y suspenso',
    descripcion: 'Relatos de terror, leyendas y casos paranormales — para las noches largas.',
    termino: 'cuentos de terror',
    feeds: [
      {
        titulo: 'Relatos de Horror (Historias de Terror)',
        url: 'https://feeds.acast.com/public/shows/b03e3a16-b9c8-5f9c-87aa-916e569f05bc',
        nota: 'Historias de terror narradas desde 2016 — el más completo de la lista.',
        eps: 209,
        imagen: 'https://assets.pippa.io/shows/614db215772a0660606159b4/1756837801949-d27f45fd-76c0-442d-9535-c312e999ad76.jpeg',
      },
      {
        titulo: 'Historias de terror, leyendas y paranormales',
        url: 'https://media.rss.com/historias-de-terror-el-podcast/feed.xml',
        nota: 'Leyendas urbanas, casos paranormales y hechos misteriosos.',
        eps: 99,
        imagen: 'https://media.rss.com/historias-de-terror-el-podcast/20250816_110819_2afd83f07d745a10cfcfd52ddd9eedf3.png',
      },
      {
        titulo: 'Cuentos de Terror',
        url: 'https://www.spreaker.com/show/6789843/episodes/feed',
        nota: 'Cuentos de terror narrados, directos y sin adornos.',
        eps: 75,
        imagen: 'https://d3wo5wojvuv7l.cloudfront.net/t_rss_itunes_square_1400/images.spreaker.com/original/576da340e7b70b63a7d6d596c0888005.jpg',
      },
      {
        titulo: 'Inframundo Relatos de Terror',
        url: 'https://anchor.fm/s/10aa0b1ac/podcast/rss',
        nota: 'Relatos y casos de terror y posesiones documentados.',
        eps: 124,
        imagen: 'https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/44632707/44632707-1784824470545-166e021fb4fec.jpg',
      },
      {
        titulo: 'Relatos de Terror — Camina hacia el Terror',
        url: 'https://www.spreaker.com/show/6785793/episodes/feed',
        nota: 'Relatos de terror atmosféricos, narrados con calma.',
        eps: 59,
        imagen: 'https://d3wo5wojvuv7l.cloudfront.net/t_rss_itunes_square_1400/images.spreaker.com/original/6c10cd7bb25361fb212ce7319592c228.jpg',
      },
      {
        titulo: 'PseudoPod (inglés)',
        url: 'https://pseudopod.org/feed/',
        nota: 'El clásico del terror en inglés, relatos semanales.',
        eps: 40,
        idioma: 'en',
        imagen: 'https://pseudopod.org/wp-content/uploads/2018/04/cropped-PseudoPod-chip-32x32.png',
      },
    ],
  },
  {
    id: 'misterio',
    emoji: '🔎',
    nombre: 'Misterio y crimen',
    descripcion: 'Casos reales, crímenes y misterios sin resolver, narrados.',
    termino: 'misterio',
    feeds: [
      {
        titulo: 'Relatos: Historias de Crímenes',
        url: 'https://rss.buzzsprout.com/1125854.rss',
        nota: 'Crímenes, desapariciones y casos resueltos o sin resolver, narrados.',
        eps: 97,
        imagen: 'https://storage.buzzsprout.com/7isav0xrert0u7yz527d6rsqk6vx?.jpg',
      },
      {
        titulo: 'Código Misterio',
        url: 'https://feeds.simplecast.com/eti7bppm',
        nota: 'Ovnis, fantasmas, pirámides y misterios inexplicables.',
        eps: 89,
        imagen: 'https://image.simplecastcdn.com/images/437cc696-952c-45cf-9995-823009940ef3/78ef9801-a3c0-47cf-8874-f4c639a85215/3000x3000/revolver-square.png?aid=rss_feed',
      },
      {
        titulo: 'Martes de Misterio',
        url: 'https://feeds.simplecast.com/EY2hNQ16',
        nota: 'Misterios, casos y lugares con historia, cada martes.',
        eps: 138,
        imagen: 'https://image.simplecastcdn.com/images/5c3cd0f7-6ae8-4f59-8466-818390b90aab/08220357-ba3b-4b16-865c-4b6a8a4973cb/3000x3000/42252713-1729274950620-d462eb12c6d2d.jpg?aid=rss_feed',
      },
      {
        titulo: 'Noche de Misterio',
        url: 'https://www.spreaker.com/show/5313242/episodes/feed',
        nota: 'Ovnis, mitos, leyendas y los misterios del universo.',
        eps: 160,
        imagen: 'https://d3wo5wojvuv7l.cloudfront.net/t_rss_itunes_square_1400/images.spreaker.com/original/ce55ae1c5b8121321d0cabe21a4aaa1d.jpg',
      },
      {
        titulo: 'Ventana al Misterio',
        url: 'https://www.spreaker.com/show/6208419/episodes/feed',
        nota: 'Investigaciones y misterios sin resolver.',
        eps: 67,
        imagen: 'https://d3wo5wojvuv7l.cloudfront.net/t_rss_itunes_square_1400/images.spreaker.com/original/dc1cf3e32a2751a33b8965c70d3818bd.jpg',
      },
    ],
  },
  {
    id: 'fantasia',
    emoji: '🏰',
    nombre: 'Fantasía y aventura',
    descripcion: 'Historias de fantasía narradas: rol, Tolkien, mundos mágicos.',
    termino: 'cuentos de fantasia',
    feeds: [
      {
        titulo: 'Refugio del aventurero — Historias de Fantasía',
        url: 'https://feeds.ivoox.com/feed_fg_f1675543_filtro_1.xml',
        nota: 'Historias de fantasía narradas, con rol y aventura — el más grande (390 eps).',
        eps: 390,
        imagen: 'https://static-1.ivoox.com/canales/4/a/3/f/4a3f517f7c6ad27f2ea4a61851bdbe11_XXL.jpg',
      },
      {
        titulo: 'Red Key Podcast — Fantasía, cf y terror',
        url: 'https://redkeybooks.com/feed/podcast',
        nota: 'Narrativa fantástica, ciencia ficción y terror.',
        eps: 93,
        imagen: 'https://redkeybooks.com/wp-content/uploads/2021/03/cropped-logo-redondo-red-key-32x32.jpg',
      },
      {
        titulo: 'Podcast La Guerra del Anillo',
        url: 'https://feeds.ivoox.com/feed_fg_f1148417_filtro_1.xml',
        nota: 'Tolkien, batallas estratégicas y el mundo mágico de la Tierra Media.',
        eps: 43,
        imagen: 'https://static-2.ivoox.com/canales/9/7/3/7/4711470747379_XXL.jpg',
      },
      {
        titulo: 'La Radio del Merodeador',
        url: 'https://anchor.fm/s/5e0bcd78/podcast/rss',
        nota: 'El primer podcast argentino sobre Harry Potter y el mundo mágico.',
        eps: 60,
        imagen: 'https://d3t3ozftmdmh3i.cloudfront.net/production/podcast_uploaded_nologo/15678318/15678318-1622853232594-75f5e783d06ac.jpg',
      },
    ],
  },
  {
    id: 'romance',
    emoji: '💕',
    nombre: 'Romance',
    descripcion: 'Novelas románticas narradas y clubes de lectura del género.',
    termino: 'novela romantica',
    feeds: [
      {
        titulo: 'Historias para Escuchar',
        url: 'https://www.spreaker.com/show/6443624/episodes/feed',
        nota: 'Audiolibros de novela romántica, capítulo a capítulo.',
        eps: 111,
        imagen: 'https://d3wo5wojvuv7l.cloudfront.net/t_rss_itunes_square_1400/images.spreaker.com/original/a82635c7d4f543a4c80cf542132bc7f1.jpg',
      },
      {
        titulo: 'Mundo Audiolibro — Romance y drama',
        url: 'https://www.spreaker.com/show/6739106/episodes/feed',
        nota: 'Audiolibros completos de romance, amor y drama.',
        eps: 9,
        imagen: 'https://d3wo5wojvuv7l.cloudfront.net/t_rss_itunes_square_1400/images.spreaker.com/original/1570b6617b490351c52b3bdee5415adb.jpg',
      },
      {
        titulo: 'Románticas Club 2.0',
        url: 'https://anchor.fm/s/8ea3ac8/podcast/rss',
        nota: 'Club de lectura: comentan novelas románticas (no narradas).',
        eps: 117,
        imagen: 'https://d3t3ozftmdmh3i.cloudfront.net/production/podcast_uploaded/1395682/1395682-1674561474108-6e245206fd919.jpg',
      },
      {
        titulo: 'Leo Romántica Podcast',
        url: 'https://anchor.fm/s/d9ac1b18/podcast/rss',
        nota: 'Otro club de lectura romántico, con reseñas y recomendaciones.',
        eps: 58,
        imagen: 'https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/36419350/36419350-1749578683037-5c528d5c12f81.jpg',
      },
    ],
  },
];

/** Busca una categoría por su id (null si no existe) */
export function categoriaPorId(id: string): CategoriaPodcast | null {
  return CATEGORIAS_PODCAST.find((c) => c.id === id) || null;
}

/** Total de feeds curados en todo el catálogo */
export function totalFeedsCurados(): number {
  return CATEGORIAS_PODCAST.reduce((n, c) => n + c.feeds.length, 0);
}

/** ¿El usuario ya sigue algún feed del catálogo? (para el chip de la categoría) */
export function categoriaConSeguidas(id: string, feedUrlsSeguidas: string[]): boolean {
  const cat = categoriaPorId(id);
  if (!cat) return false;
  const seguidas = new Set(feedUrlsSeguidas);
  return cat.feeds.some((f) => seguidas.has(f.url));
}
