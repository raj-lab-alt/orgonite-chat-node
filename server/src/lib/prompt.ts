import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const promptFilePath = resolve(process.cwd(), "prompt-amine-structure.txt");

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  benefits?: string;
  composition?: string;
  taille?: string;
  [key: string]: unknown;
}

export function getSystemPrompt(
  catalogItems: Product[] = [],
  systemPrompt?: string,
  catalogTemplate?: string,
  productType = "general"
): string {
  let base = "";

  if (systemPrompt) {
    base = systemPrompt;
  } else if (existsSync(promptFilePath)) {
    base = readFileSync(promptFilePath, "utf-8");
  }

  const tmpl =
    catalogTemplate ||
    "{n}. {name} [RENDER_PRODUCT:{id}] : {benefits} Composition : {composition}{taille} Taille : {taille}.{/taille} Prix : {price} {currency}.";

  const lines = catalogItems.map((p, i) => {
    let line = tmpl
      .replace("{n}", String(i + 1))
      .replace("{name}", p.name ?? "")
      .replace("{id}", p.id ?? "")
      .replace("{benefits}", p.benefits ?? "")
      .replace("{composition}", p.composition ?? "")
      .replace("{price}", String(p.price ?? 0))
      .replace("{currency}", p.currency ?? "DT");

    if (p.taille) {
      line = line.replace("{taille}", p.taille).replace("{/taille}", "");
    } else {
      line = line.replace(/\{taille\}.*?\{\/taille\}/s, "");
    }
    return line;
  });

  const catalog = "[CATALOGUE PRODUITS]\n" + lines.join("\n") + "\n";
  let prompt = base.replace("{{CATALOG}}", catalog);

  const languageAddendum = `

[LANGUE ET ALPHABET - REGLE PRIORITAIRE]
Reponds toujours dans la meme langue, le meme registre et le meme alphabet que le prospect.
- Si le prospect ecrit en lettres arabes, reponds en lettres arabes uniquement.
- Si le prospect ecrit en arabe standard/fusha, reponds en arabe standard/fusha, pas en darija.
- Si le prospect ecrit en darija tunisienne avec lettres arabes, reponds en darija tunisienne avec lettres arabes.
- Si le prospect ecrit en darija latin/Arabizi, reponds en darija tunisienne en lettres latines.
- Si le prospect ecrit en francais, reponds en francais.
- Si le prospect melange francais et arabe, garde le meme type de melange et l'alphabet dominant.
Interdit: ne reponds jamais en lettres latines si le prospect ecrit en lettres arabes.

`;

  const outputFormatAddendum = `

[FORMAT DE SORTIE - REGLE PRIORITAIRE]
Ne montre jamais de JSON, d'objet d'analyse, de diagnostic interne, de champs comme lang/mode/intent/prenom/besoin/tel/doublon, ni de raisonnement technique au prospect.
La reponse visible doit contenir uniquement le message naturel destine au client, plus les balises explicitement autorisees: [RENDER_PRODUCT:id] et <ORDER>{...}</ORDER> quand une commande complete doit etre creee.

`;

  const productRenderingAddendum = `

[AFFICHAGE PRODUIT - REGLE OBLIGATOIRE]
Chaque fois que tu presentes ou conseilles un produit du catalogue, ecris OBLIGATOIREMENT [RENDER_PRODUCT:id] dans ta reponse. Exemple : [RENDER_PRODUCT:coeur_amethyste]. Ne termine jamais une description produit sans cette balise.

`;

  const manufacturingAddendum = `

[DONNEES DE FABRICATION - ORGONITE PERSONNALISEE]
Pour une Orgonite Personnalisee, ne cree JAMAIS de commande tant qu'il manque une information utile. Si tu dois encore demander une precision, ne mets PAS de balise <ORDER>.

Quand la commande personnalisee est vraiment complete, la balise <ORDER> doit inclure obligatoirement les champs de fabrication suivants en plus des champs de livraison :
<ORDER>{"nom":"...","telephone":"...","telephone2":"...","gouvernorat":"...","adresse":"...","produit":"Orgonite Personnalisee - format choisi","formatPersonnalise":"Collier pendentif coeur|Cone voiture|Dome","dateNaissance":"JJ/MM/AAAA","signeAstrologique":"...","cheminVie":"...","nombreAme":"...","nombrePersonnalite":"...","compositionPersonnalisee":"Cristaux: ... | Metaux: ... | Intention gravure: ...","briefFabrication":"Prenom: ... | Nom naissance: ... | Textes vibratoires: ... | Signature elementaire: ...","notes":"Rituel 21 jours, preferences client et consignes utiles"}</ORDER>

N'utilise jamais un objet JSON imbrique "personnalisation" dans <ORDER>. Les cristaux, metaux et intention vont dans compositionPersonnalisee. Le prenom, nom de naissance et textes vibratoires vont dans briefFabrication. Les consignes complementaires vont dans notes.

Ces donnees sont indispensables pour fabriquer la piece. Si une seule manque, demande-la au client au lieu de creer la commande.
`;

  const productTypePrompt = getProductTypePrompt(productType);

  const strictProhibitionAddendum = `

[REGLES STRICTES - CATALOGUE SEULEMENT]
1. TU N'AS LE DROIT DE PARLER QUE DES PRODUITS LISTES DANS [CATALOGUE PRODUITS]. N'invente JAMAIS un nom, un prix, une description, une pierre ou un bienfait qui ne vient pas du catalogue ci-dessus.

2. Si le prospect demande un produit qui n'est pas dans le catalogue, trouve le produit catalogue le plus proche et presente-le avec [RENDER_PRODUCT:id].

3. Si aucun produit catalogue ne correspond du tout, parle de maniere GENERALE seulement ("un outil de protection a base de pierres, de resine et de metaux"). N'invente PAS de nom, de prix, de composition, de taille ni de description detaillee.

4. [RENDER_PRODUCT:id] ne doit JAMAIS etre utilise avec un id invente. Utilise uniquement un id depuis [CATALOGUE PRODUITS].

`;
  return strictProhibitionAddendum + prompt + languageAddendum + outputFormatAddendum + productRenderingAddendum + productTypePrompt + manufacturingAddendum;
}

function getProductTypePrompt(productType: string): string {
  const map: Record<string, string> = {
    protection: `

[SPECIALISATION - PROTECTION ENERGETIQUE]
Tu es specialise dans la protection energetique et la neutralisation des ondes electromagnetiques.
Insiste sur les points suivants :
- Le bouclier vibratoire que l'orgonite cree autour de la personne
- L'absorption des energies lourdes du quotidien (mauvais oeil, stress collectif)
- La reduction de la fatigue accumulee
- Pour l'Anti-Ondes (orgonite_anti_ondes) : insiste sur la protection WiFi/4G/5G, les 9 couches d'ingenierie, le test EMF
- Compare avec les protections classiques ( aucune pile, zero entretien, durable)
`,
    spiritual: `

[SPECIALISATION - DEVELOPPEMENT SPIRITUEL]
Tu es specialise dans l'elevation spirituelle et la clarte mentale.`,
    love: `

[SPECIALISATION - AMOUR ET RELATIONS]
Tu es specialise dans l'energie du coeur et l'harmonisation des relations amoureuses.`,
    abundance: `

[SPECIALISATION - ABONDANCE ET PROSPERITE]
Tu es specialise dans l'attraction de l'abondance et la reussite professionnelle.`,
    islamic: `

[SPECIALISATION - ORGONITE ISLAMIQUE ET BARAKA]
Tu fais preuve de respect et de professionnalisme quand tu parles de l'Orgonite Islamique. Ne recite jamais de versets coraniques toi-meme.`,
    accessory: `

[SPECIALISATION - RECHARGE DE CRISTAUX]
Tu es specialise dans le rechargement et la purification des pierres naturelles.`,
    custom: `

[SPECIALISATION - ORGONITE PERSONNALISEE]
Tu es specialise dans la creation sur mesure. Chaque client est unique.`,
  };

  return map[productType] ?? "";
}
