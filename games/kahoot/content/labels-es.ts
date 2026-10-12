// Moved from client/strings-picker-es.ts (ADR-054): plain data shared by the phone strings and the
// server's Spanish recap, so neither side imports the other.
// Lightning Round's category and topic names in Spanish (the manifest's options), which the screens
// show as the server sends them (content/schema.ts `labelOf`), and the tagline the TV's intro shows.
// The manifest's full sentences live in manifest.es.json (ADR-049). Keyed by the English sentence.

export const PICKER_ES: Readonly<Record<string, string>> = {
  'Fast fingers, sharp minds. Bet big on the last one.':
    'Dedos rápidos, mentes agudas. Apuesta fuerte en la última.',

  // Categories
  'All categories': 'Todas las categorías',
  Geography: 'Geografía',
  STEM: 'Ciencia y tecnología',
  History: 'Historia',
  'Arts & Literature': 'Arte y literatura',
  Sports: 'Deportes',
  'Food & Drink': 'Comida y bebida',
  Nature: 'Naturaleza',
  Language: 'Lengua',
  Entertainment: 'Entretenimiento',
  'Everyday Life': 'Vida cotidiana',
  'Board & Card Games': 'Juegos de mesa y cartas',
  'World Heritage': 'Patrimonio Mundial',
  'Museum Collections': 'Colecciones de museos',
  'Ig Nobel Science': 'Ciencia Ig Nobel',

  // Topics: Geography
  Capitals: 'Capitales',
  'Cities & Landmarks': 'Ciudades y monumentos',
  'Physical Geography': 'Geografía física',
  'Flags & Borders': 'Banderas y fronteras',
  'World Regions': 'Regiones del mundo',
  // STEM
  Physics: 'Física',
  Chemistry: 'Química',
  Biology: 'Biología',
  'Astronomy & Space': 'Astronomía y espacio',
  Math: 'Matemáticas',
  'Engineering & Technology': 'Ingeniería y tecnología',
  Computing: 'Informática',
  // History
  'Ancient World': 'Mundo antiguo',
  'Medieval & Renaissance': 'Edad Media y Renacimiento',
  'Modern History': 'Historia moderna',
  'US History': 'Historia de EE. UU.',
  'Leaders & Royals': 'Líderes y realeza',
  'Wars & Revolutions': 'Guerras y revoluciones',
  'Inventions & Discoveries': 'Inventos y descubrimientos',
  // Arts & Literature
  'Painting & Sculpture': 'Pintura y escultura',
  'Novels & Authors': 'Novelas y autores',
  'Poetry & Plays': 'Poesía y teatro',
  'Mythology & Folklore': 'Mitología y folclore',
  'Architecture & Design': 'Arquitectura y diseño',
  'Classical Music & Dance': 'Música clásica y danza',
  // Sports
  Basketball: 'Baloncesto',
  Football: 'Fútbol americano',
  Baseball: 'Béisbol',
  Soccer: 'Fútbol',
  Olympics: 'Juegos Olímpicos',
  'Tennis & Golf': 'Tenis y golf',
  Hockey: 'Hockey',
  'Motorsport & More': 'Automovilismo y más',
  // Food & Drink
  'World Cuisines': 'Cocinas del mundo',
  Ingredients: 'Ingredientes',
  'Cooking & Kitchen': 'Cocina y utensilios',
  Drinks: 'Bebidas',
  'Sweets & Desserts': 'Dulces y postres',
  // Nature
  Mammals: 'Mamíferos',
  'Birds, Reptiles & Fish': 'Aves, reptiles y peces',
  'Insects & Sea Life': 'Insectos y vida marina',
  'Plants & Trees': 'Plantas y árboles',
  'Earth & Weather': 'Tierra y clima',
  'Human Body': 'Cuerpo humano',
  // Language
  Vocabulary: 'Vocabulario',
  'Grammar & Spelling': 'Gramática y ortografía',
  'Idioms & Phrases': 'Expresiones y dichos',
  'World Languages': 'Idiomas del mundo',
  'Word Origins': 'Origen de las palabras',
  // Entertainment
  Movies: 'Cine',
  'TV Shows': 'Series de TV',
  'Pop Music': 'Música pop',
  'Video Games': 'Videojuegos',
  'Comics & Animation': 'Cómics y animación',
  // Everyday Life
  'Brands & Logos': 'Marcas y logos',
  'Holidays & Traditions': 'Fiestas y tradiciones',
  'Money & Business': 'Dinero y negocios',
  'Travel & Transport': 'Viajes y transporte',
  'Units & Measures': 'Unidades y medidas',

  // BL-015 content categories
  'Tabletop Rules': 'Reglas de juegos de mesa',
  'Heritage Sites': 'Sitios del Patrimonio Mundial',
  'Collection Artists': 'Artistas de la colección',
  'Unlikely Research': 'Investigaciones insólitas',
};
