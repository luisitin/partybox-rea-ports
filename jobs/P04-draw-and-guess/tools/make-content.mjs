// Original prompt lists authored for this port; no imported game vocabulary.
import { writeFileSync } from 'node:fs';
const decks = {
  easy: `cat|sun|house|fish|tree|flower|car|star|boat|balloon|apple|umbrella|dog|moon|chair|table|book|cup|shoe|hat|sock|bed|door|window|clock|key|spoon|fork|plate|bowl|cake|bread|pizza|banana|pear|orange|lemon|grape|cherry|carrot|potato|tomato|corn|egg|cheese|cookie|ice cream|lollipop|donut|sandwich|bird|duck|frog|pig|cow|horse|sheep|mouse|rabbit|bear|lion|tiger|elephant|giraffe|zebra|turtle|crab|snail|butterfly|bee|ant|worm|leaf|cloud|rain|snow|mountain|river|beach|island|rock|heart|circle|triangle|square|pencil|crayon|scissors|brush|comb|toothbrush|soap|bell|drum|guitar|ball|kite|swing|slide|tent`,
  medium: `lighthouse|volcano|snowman|castle|robot|windmill|submarine|rocket|spider|helicopter|bicycle|hourglass|penguin|octopus|dinosaur|crocodile|hippopotamus|rhinoceros|squirrel|kangaroo|flamingo|peacock|ostrich|hedgehog|raccoon|walrus|dolphin|whale|shark|seahorse|starfish|lobster|caterpillar|grasshopper|dragonfly|mushroom|cactus|pineapple|watermelon|pumpkin|broccoli|pretzel|pancake|waffle|popcorn|teapot|kettle|blender|toaster|refrigerator|microwave|oven|ladder|hammer|screwdriver|wrench|saw|wheelbarrow|watering can|rake|shovel|mailbox|fireplace|chimney|bathtub|shower|sink|mirror|suitcase|backpack|wallet|necklace|bracelet|crown|helmet|skateboard|roller skate|scooter|motorcycle|tractor|bulldozer|ambulance|fire engine|bus|train|airplane|sailboat|canoe|surfboard|parachute|anchor|treasure chest|pirate|astronaut|chef|clown|wizard|mermaid|scarecrow|snowflake`,
  hard: `constellation|telescope|chandelier|jellyfish|dragon|tornado|campfire|ferris wheel|hot air balloon|roller coaster|paper airplane|drawbridge|solar system|satellite|space station|meteor shower|northern lights|rainbow|lightning|waterfall|geyser|glacier|iceberg|coral reef|desert oasis|sandcastle|palm tree|coconut|bamboo|bonsai|venus flytrap|maple syrup|honeycomb|gingerbread house|fortune cookie|chocolate fountain|banana split|spaghetti|dumpling|sushi roll|fried rice|taco|burrito|lasagna|bagel|croissant|tortilla|avocado|pomegranate|artichoke|lobster pot|picnic basket|traffic light|pedestrian crossing|roundabout|suspension bridge|railway station|airport tower|parking meter|vending machine|telephone booth|water tower|observatory|greenhouse|wind turbine|watermill|oil rig|crane|excavator|snowplow|lifeboat|icebreaker|steam engine|paddleboat|unicycle|tandem bicycle|trampoline|balance beam|bowling alley|dartboard|chessboard|domino|jigsaw puzzle|marionette|accordion|bagpipes|xylophone|trumpet|violin|saxophone|megaphone|microphone|stethoscope|thermometer|compass|magnifying glass|binoculars|periscope|metronome|typewriter`,
};
const unique = new Set();
for (const [name, text] of Object.entries(decks)) {
  const words = text.split('|');
  if (words.length !== 100) throw new Error(`${name}: ${words.length} words, expected100`);
  for (const word of words) {
    if (unique.has(word)) throw new Error(`Duplicate: ${word}`);
    unique.add(word);
  }
  writeFileSync(
    new URL(`../../../games/draw-and-guess/content/${name}.json`, import.meta.url),
    JSON.stringify(words, null, 2) + '\n',
  );
}
console.log(`Wrote ${unique.size} unique original words.`);
