# Lightning Round: BL-015 sources

Checked 2026-09-30. Added 200 English questions and matching es-MX twins: 50 each
in Board & Card Games, World Heritage, Museum Collections and Ig Nobel Science.
Every added ID, answer, URL and verification locator appears in
[the 200-row source report](../../../reports/content/lightning-round-sources.md)
and `content-pack-origins.json`.

| Dataset / source                                                                   | Repo and pinned commit                                                                                                                                                                                                                                           | License, attribution and scope                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OpenTriviaQA, by uberspot and contributors; `categories/hobbies`                   | [uberspot/OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA/tree/dcc1cdf36c2985ed5c849d1f2265c5041ffcdfb9), `dcc1cdf36c2985ed5c849d1f2265c5041ffcdfb9`                                                                                                      | [CC BY-SA 4.0](https://github.com/uberspot/OpenTriviaQA/blob/dcc1cdf36c2985ed5c849d1f2265c5041ffcdfb9/LICENSE). Board-game seeds were selected, checked against the publishers' rules, rewritten, and localized; source-line locators are recorded per question.                                                               |
| UNESCO World Heritage List, `whc001`, © UNESCO                                     | Pinned mirror [xyn-1127/unesco-heritage-explorer](https://github.com/xyn-1127/unesco-heritage-explorer/tree/788ff24bf5c819ab09aeb6207a8224fe4cb3a9e3), `788ff24bf5c819ab09aeb6207a8224fe4cb3a9e3`, `whc001.json` blob `f3c9bb2bd21ce9163ae85f28efed7dedca26bc08` | [UNESCO DataHub dataset](https://data.unesco.org/explore/dataset/whc001/information/) states **CC BY-SA 4.0**. Reuse only names, countries and first-inscription years. The mirror's MIT license covers application code, not the UNESCO data.                                                                                 |
| The Metropolitan Museum of Art, Open Access basic collection metadata              | [metmuseum/openaccess](https://github.com/metmuseum/openaccess/tree/6fa206f0df6cf349d4fe558028d4c08e95f44eb6), `6fa206f0df6cf349d4fe558028d4c08e95f44eb6`                                                                                                        | [CC0 1.0](https://github.com/metmuseum/openaccess/blob/6fa206f0df6cf349d4fe558028d4c08e95f44eb6/LICENSE). Exact object records retrieved from the [Met Collection API](https://metmuseum.github.io/) on the check date, not from the pinned CSV. Only title, artist and object ID are reused; no images or descriptive essays. |
| Ig Nobel organizer's official [winner archive](https://improbable.com/ig/winners/) | Website; no Git revision. Snapshot checked 2026-09-30.                                                                                                                                                                                                           | No open license identified for the website's prose; underlying article/patent rights vary. Only factual study topics and award identifiers are independently paraphrased; citation prose, papers and figures are not copied. Per-row locators include the underlying references.                                               |
| Existing PartyBox schemas, topic settings, localized labels and SDK normalizer     | [luisitin/partybox](https://github.com/luisitin/partybox/tree/c26bc2c7542e23edd757586fac1f9d1bdf328dd0), `c26bc2c7542e23edd757586fac1f9d1bdf328dd0`                                                                                                              | Owner-authorized project material; no root LICENSE in the pinned tree.                                                                                                                                                                                                                                                         |

## Primary rules used to verify board/card answers

Publisher/federation and rules-reference sites below were consulted for factual
rules. No open license is asserted for their prose or artwork; no passages,
diagrams or images were imported. Editions are fixed by the linked PDFs (classic
UNO, English-language Scrabble and the 2020 CATAN base rules).

- https://bicyclecards.com/how-to-play/bridge
- https://bicyclecards.com/how-to-play/canasta
- https://bicyclecards.com/how-to-play/cribbage
- https://bicyclecards.com/how-to-play/gin-rummy
- https://bicyclecards.com/how-to-play/hearts
- https://bicyclecards.com/how-to-play/whist
- https://handbook.fide.com/chapter/e012023
- https://instructions.hasbro.com/en-us/instruction/Scrabble-Game
- https://service.mattel.com/instruction_sheets/UNO%20Basic%20IS.pdf
- https://usbgf.org/beginners-guide-to-backgammon/
- https://www.catan.com/sites/default/files/2021-06/catan_base_rules_2020_200707.pdf
- https://www.hasbro.com/common/instruct/Monopoly_Vintage.pdf
- https://www.pagat.com/domino/terms.html
- https://www.pagat.com/domino/trick/texas42.html
- https://www.worldothello.org/about/about-othello/othello-rules/official-rules/english

## Adaptations and new work

OpenTriviaQA supplied board/card seeds; additional rules from the same games fill
the 50-question category. Question wording, three distractors, difficulty tags,
balanced answer positions and Spanish adaptations are new schema-fitting work.
An incorrect double-twelve domino seed was checked against the rules reference
and corrected to 91 tiles. A Scrabble board-size question extends the rack/score
seed rather than claiming that source line contains the board dimensions.

UNESCO record IDs and Met object IDs identify distinct subjects. Titles were
shortened where necessary and translated for es-MX; original titles and metadata
fields are retained in the source report. First-inscription year is explicit,
so later UNESCO extensions do not change the intended answer. Ig Nobel questions
ask what a particular cited project studied, not whether its findings generalize.

The added `bcp-` and `whc-` questions and their Spanish twins are distributed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with the source
attribution and modifications above. Met-derived basic metadata remains CC0;
the `mcp-` question adaptations and Spanish twins are also dedicated to CC0.
The `ign-` wording/distractors are new writing around factual premises; no open
license over the referenced website, research articles or figures is implied.
Upstream datasets are supplied as-is. Existing content and code retain their
existing status. No new dependency or artwork is added.

Four category/topic identifiers and their EN/ES settings labels are the small
code gap needed to expose the new decks. Established categories still require
300+ questions in the content test; the four 50-question additions satisfy the
existing 30-per-topic rule and preserve answer-position/difficulty checks.

Run `pnpm exec tsx scripts/check-content-pack-duplicates.ts` for all pack schemas,
normalized exact checks and near-prompt candidates. Reviewed pairs distinguish
different site/object records or rule properties, not repeated question text.
See `reports/content/VALIDATION.md` for completed checks and limitations.

## B13 trivia (T-0703)

586 English questions from the source-reviewed B13 set (PR #22 job; 15 rows corrected from PR #28) were added. Each has one row in `content-pack-origins.json` with its URL and evidence locator; the 200-row report above does not list them. Spanish: not translated (listed in `questions.es.json` `dropped`). Quotes, evidence files and workflows are not carried; only the publisher and URL of each source used:

- `animals-nature-s0001`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/giant-panda
- `animals-nature-s0002`: San Diego Zoo Animals & Plants, https://animals.sandiegozoo.org/animals/giant-panda
- `animals-nature-s0003`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/lion
- `animals-nature-s0004`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Panthera_leo/
- `animals-nature-s0005`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/cheetah
- `animals-nature-s0007`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/tiger
- `animals-nature-s0008`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Panthera_tigris/
- `animals-nature-s0009`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/meerkat
- `animals-nature-s0010`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Suricata_suricatta/
- `animals-nature-s0011`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/western-lowland-gorilla
- `animals-nature-s0012`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Gorilla_gorilla/
- `animals-nature-s0013`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/orangutan
- `animals-nature-s0015`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/asian-elephant
- `animals-nature-s0016`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Elephas_maximus/
- `animals-nature-s0017`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/red-panda
- `animals-nature-s0018`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Ailurus_fulgens/
- `animals-nature-s0019`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/sloth-bear
- `animals-nature-s0020`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Melursus_ursinus/
- `animals-nature-s0021`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/clouded-leopard
- `animals-nature-s0022`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Neofelis_nebulosa/
- `animals-nature-s0023`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/american-flamingo
- `animals-nature-s0025`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/ostrich
- `animals-nature-s0026`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Struthio_camelus/
- `animals-nature-s0027`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/emu
- `animals-nature-s0028`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Dromaius_novaehollandiae/
- `animals-nature-s0029`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/southern-cassowary
- `animals-nature-s0031`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/american-alligator
- `animals-nature-s0032`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Alligator_mississippiensis/
- `animals-nature-s0033`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/aldabra-tortoise
- `animals-nature-s0035`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/fennec-fox
- `animals-nature-s0036`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Vulpes_zerda/
- `animals-nature-s0037`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/beaver
- `animals-nature-s0038`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Castor_canadensis/
- `animals-nature-s0039`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/giant-anteater
- `animals-nature-s0040`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Myrmecophaga_tridactyla/
- `animals-nature-s0043`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/ring-tailed-lemur
- `animals-nature-s0044`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Lemur_catta/
- `animals-nature-s0045`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/golden-lion-tamarin
- `animals-nature-s0046`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Leontopithecus_rosalia/
- `animals-nature-s0047`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/asian-small-clawed-otter
- `animals-nature-s0049`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/komodo-dragon
- `animals-nature-s0050`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Varanus_komodoensis/
- `animals-nature-s0052`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Tolypeutes_matacus/
- `animals-nature-s0055`: San Diego Zoo Animals & Plants, https://animals.sandiegozoo.org/animals/cheetah
- `animals-nature-s0056`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/la-plata-three-banded-armadillo
- `animals-nature-s0058`: Wikipedia contributors, https://en.wikipedia.org/wiki/Asian_small-clawed_otter
- `animals-nature-s0059`: Wikipedia contributors, https://en.wikipedia.org/wiki/Aldabra_giant_tortoise
- `animals-nature-s0060`: Wikipedia contributors, https://en.wikipedia.org/wiki/Bornean_orangutan
- `animals-nature-s0061`: Wikipedia contributors, https://en.wikipedia.org/wiki/American_flamingo
- `animals-nature-s0062`: Wikipedia contributors, https://en.wikipedia.org/wiki/Southern_cassowary
- `animals-nature-s0063`: San Diego Zoo Animals & Plants, https://animals.sandiegozoo.org/animals/orangutan
- `animals-nature-s0064`: San Diego Zoo Animals & Plants, https://animals.sandiegozoo.org/animals/flamingo
- `animals-nature-s5007`: Smithsonian's National Zoo and Conservation Biology Institute, https://nationalzoo.si.edu/animals/tiger
- `animals-nature-s5008`: Animal Diversity Web, University of Michigan, https://animaldiversity.org/accounts/Panthera_tigris/
- `food-everyday-life-s0001`: Encyclopaedia Britannica, https://www.britannica.com/plant/allspice
- `food-everyday-life-s0002`: Wikipedia contributors, https://en.wikipedia.org/wiki/Allspice
- `food-everyday-life-s0003`: Encyclopaedia Britannica, https://www.britannica.com/plant/vanilla
- `food-everyday-life-s0004`: Wikipedia contributors, https://en.wikipedia.org/wiki/Vanilla
- `food-everyday-life-s0005`: Encyclopaedia Britannica, https://www.britannica.com/plant/cinnamon
- `food-everyday-life-s0006`: Wikipedia contributors, https://en.wikipedia.org/wiki/Cinnamon
- `food-everyday-life-s0007`: Encyclopaedia Britannica, https://www.britannica.com/plant/clove
- `food-everyday-life-s0008`: Wikipedia contributors, https://en.wikipedia.org/wiki/Clove
- `food-everyday-life-s0009`: Encyclopaedia Britannica, https://www.britannica.com/plant/nutmeg
- `food-everyday-life-s0010`: Wikipedia contributors, https://en.wikipedia.org/wiki/Nutmeg
- `food-everyday-life-s0011`: Encyclopaedia Britannica, https://www.britannica.com/plant/saffron
- `food-everyday-life-s0012`: Wikipedia contributors, https://en.wikipedia.org/wiki/Saffron
- `food-everyday-life-s0013`: Encyclopaedia Britannica, https://www.britannica.com/plant/black-pepper-plant
- `food-everyday-life-s0014`: Wikipedia contributors, https://en.wikipedia.org/wiki/Black_pepper
- `food-everyday-life-s0015`: Encyclopaedia Britannica, https://www.britannica.com/topic/chocolate
- `food-everyday-life-s0016`: Wikipedia contributors, https://en.wikipedia.org/wiki/Chocolate
- `food-everyday-life-s0017`: Encyclopaedia Britannica, https://www.britannica.com/topic/honey
- `food-everyday-life-s0018`: Wikipedia contributors, https://en.wikipedia.org/wiki/Honey
- `food-everyday-life-s0019`: Encyclopaedia Britannica, https://www.britannica.com/topic/yogurt
- `food-everyday-life-s0020`: Wikipedia contributors, https://en.wikipedia.org/wiki/Yogurt
- `food-everyday-life-s0021`: Encyclopaedia Britannica, https://www.britannica.com/topic/butter
- `food-everyday-life-s0022`: Wikipedia contributors, https://en.wikipedia.org/wiki/Butter
- `food-everyday-life-s0023`: Encyclopaedia Britannica, https://www.britannica.com/topic/mayonnaise
- `food-everyday-life-s0024`: Wikipedia contributors, https://en.wikipedia.org/wiki/Mayonnaise
- `food-everyday-life-s0025`: Encyclopaedia Britannica, https://www.britannica.com/topic/vinegar
- `food-everyday-life-s0026`: Wikipedia contributors, https://en.wikipedia.org/wiki/Vinegar
- `food-everyday-life-s0027`: Encyclopaedia Britannica, https://www.britannica.com/topic/tofu
- `food-everyday-life-s0028`: Wikipedia contributors, https://en.wikipedia.org/wiki/Tofu
- `food-everyday-life-s0029`: Encyclopaedia Britannica, https://www.britannica.com/topic/coffee
- `food-everyday-life-s0030`: Wikipedia contributors, https://en.wikipedia.org/wiki/Coffee
- `food-everyday-life-s0031`: Encyclopaedia Britannica, https://www.britannica.com/topic/tea-beverage
- `food-everyday-life-s0032`: Wikipedia contributors, https://en.wikipedia.org/wiki/Tea
- `food-everyday-life-s0035`: Encyclopaedia Britannica, https://www.britannica.com/topic/bread
- `food-everyday-life-s0036`: Wikipedia contributors, https://en.wikipedia.org/wiki/Bread
- `food-everyday-life-s0037`: Encyclopaedia Britannica, https://www.britannica.com/topic/cheese
- `food-everyday-life-s0038`: Wikipedia contributors, https://en.wikipedia.org/wiki/Cheese
- `food-everyday-life-s0039`: Encyclopaedia Britannica, https://www.britannica.com/topic/pasta
- `food-everyday-life-s0040`: Wikipedia contributors, https://en.wikipedia.org/wiki/Pasta
- `food-everyday-life-s0041`: Encyclopaedia Britannica, https://www.britannica.com/topic/gelatin
- `food-everyday-life-s0042`: Wikipedia contributors, https://en.wikipedia.org/wiki/Gelatin
- `food-everyday-life-s0043`: Encyclopaedia Britannica, https://www.britannica.com/science/pectin
- `food-everyday-life-s0044`: Wikipedia contributors, https://en.wikipedia.org/wiki/Pectin
- `food-everyday-life-s0045`: Encyclopaedia Britannica, https://www.britannica.com/science/salt
- `food-everyday-life-s0046`: Wikipedia contributors, https://en.wikipedia.org/wiki/Salt
- `food-everyday-life-s0047`: Encyclopaedia Britannica, https://www.britannica.com/science/sugar-chemical-compound
- `food-everyday-life-s0048`: Wikipedia contributors, https://en.wikipedia.org/wiki/Sugar
- `food-everyday-life-s0049`: Encyclopaedia Britannica, https://www.britannica.com/plant/turmeric
- `food-everyday-life-s0050`: Wikipedia contributors, https://en.wikipedia.org/wiki/Turmeric
- `food-everyday-life-s0051`: Encyclopaedia Britannica, https://www.britannica.com/plant/ginger
- `food-everyday-life-s0052`: Wikipedia contributors, https://en.wikipedia.org/wiki/Ginger
- `food-everyday-life-s0057`: Encyclopaedia Britannica, https://www.britannica.com/plant/chili-pepper
- `food-everyday-life-s0058`: Wikipedia contributors, https://en.wikipedia.org/wiki/Chili_pepper
- `food-everyday-life-s0059`: Encyclopaedia Britannica, https://www.britannica.com/science/yeast-fungus
- `food-everyday-life-s0060`: Wikipedia contributors, https://en.wikipedia.org/wiki/Yeast
- `food-everyday-life-s0063`: Encyclopaedia Britannica, https://www.britannica.com/science/salt/Salt-manufacture
- `food-everyday-life-s5015`: Encyclopaedia Britannica, https://www.britannica.com/topic/chocolate
- `food-everyday-life-s5016`: Wikipedia contributors, https://en.wikipedia.org/wiki/Chocolate
- `food-everyday-life-s5021`: Encyclopaedia Britannica, https://www.britannica.com/topic/butter
- `food-everyday-life-s5022`: Wikipedia contributors, https://en.wikipedia.org/wiki/Butter
- `food-everyday-life-s5129`: Encyclopaedia Britannica, https://www.britannica.com/topic/coffee
- `food-everyday-life-s5130`: Wikipedia contributors, https://en.wikipedia.org/wiki/Coffee
- `movies-tv-s0001`: Wikipedia, https://en.wikipedia.org/wiki/Casablanca_(film)
- `movies-tv-s0002`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/27175
- `movies-tv-s0003`: Wikipedia, https://en.wikipedia.org/wiki/Citizen_Kane
- `movies-tv-s0004`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/27624
- `movies-tv-s0005`: Wikipedia, https://en.wikipedia.org/wiki/The_Godfather
- `movies-tv-s0006`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/54023
- `movies-tv-s0007`: Wikipedia, https://en.wikipedia.org/wiki/Gone_with_the_Wind_(film)
- `movies-tv-s0008`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/1181
- `movies-tv-s0009`: Wikipedia, https://en.wikipedia.org/wiki/The_Wizard_of_Oz_(1939_film)
- `movies-tv-s0010`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/7892
- `movies-tv-s0011`: Wikipedia, https://en.wikipedia.org/wiki/Jaws_(film)
- `movies-tv-s0012`: American Film Institute, https://catalog.afi.com/Film/55193-JAWS
- `movies-tv-s0013`: Wikipedia, https://en.wikipedia.org/wiki/E.T._the_Extra-Terrestrial
- `movies-tv-s0014`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/67140
- `movies-tv-s0015`: Wikipedia, https://en.wikipedia.org/wiki/Star_Wars_(film)
- `movies-tv-s0016`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/55187
- `movies-tv-s0017`: Wikipedia, https://en.wikipedia.org/wiki/Jurassic_Park_(film)
- `movies-tv-s0018`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/67200
- `movies-tv-s0019`: Wikipedia, https://en.wikipedia.org/wiki/Back_to_the_Future
- `movies-tv-s0020`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/55763
- `movies-tv-s0021`: Wikipedia, https://en.wikipedia.org/wiki/The_Matrix
- `movies-tv-s0022`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/61230
- `movies-tv-s0023`: Wikipedia, https://en.wikipedia.org/wiki/Alien_(film)
- `movies-tv-s0024`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/53908
- `movies-tv-s0025`: Wikipedia, https://en.wikipedia.org/wiki/Psycho_(1960_film)
- `movies-tv-s0026`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/53260
- `movies-tv-s0027`: Wikipedia, https://en.wikipedia.org/wiki/The_Terminator
- `movies-tv-s0028`: American Film Institute, https://catalog.afi.com/Catalog/MovieDetails/57224
- `movies-tv-s0029`: Wikipedia, https://en.wikipedia.org/wiki/Pulp_Fiction
- `movies-tv-s0030`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/55207
- `movies-tv-s0031`: Wikipedia, https://en.wikipedia.org/wiki/Snow_White_and_the_Seven_Dwarfs_(1937_film)
- `movies-tv-s0032`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/5865
- `movies-tv-s0033`: Wikipedia, https://en.wikipedia.org/wiki/Beauty_and_the_Beast_(1991_film)
- `movies-tv-s0034`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/55212
- `movies-tv-s0035`: Wikipedia, https://en.wikipedia.org/wiki/Aladdin_(1992_Disney_film)
- `movies-tv-s0036`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/67020
- `movies-tv-s0037`: Wikipedia, https://en.wikipedia.org/wiki/The_Lion_King_(1994_film)
- `movies-tv-s0038`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/60348
- `movies-tv-s0039`: Wikipedia, https://en.wikipedia.org/wiki/Toy_Story
- `movies-tv-s0040`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/55210
- `movies-tv-s0041`: Wikipedia, https://en.wikipedia.org/wiki/Rocky
- `movies-tv-s0042`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/53862
- `movies-tv-s0043`: Wikipedia, https://en.wikipedia.org/wiki/Titanic_(1997_film)
- `movies-tv-s0044`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/55202
- `movies-tv-s0045`: Wikipedia, https://en.wikipedia.org/wiki/Mary_Poppins_(film)
- `movies-tv-s0046`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/23290
- `movies-tv-s0047`: Wikipedia, https://en.wikipedia.org/wiki/The_Sound_of_Music_(film)
- `movies-tv-s0048`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/22305
- `movies-tv-s0049`: Wikipedia, https://en.wikipedia.org/wiki/The_Shawshank_Redemption
- `movies-tv-s0050`: American Film Institute, https://catalog.afi.com/Catalog/moviedetails/55199
- `music-s0001`: Wikipedia, https://en.wikipedia.org/wiki/The_Beatles
- `music-s0002`: Encyclopaedia Britannica, https://www.britannica.com/topic/the-Beatles
- `music-s0003`: Wikipedia, https://en.wikipedia.org/wiki/Elvis_Presley
- `music-s0004`: Encyclopaedia Britannica, https://kids.britannica.com/kids/article/Elvis-Presley/399570
- `music-s0005`: Wikipedia, https://en.wikipedia.org/wiki/Queen_(band)
- `music-s0006`: Encyclopaedia Britannica, https://www.britannica.com/topic/Queen-British-rock-group
- `music-s0007`: Wikipedia, https://en.wikipedia.org/wiki/The_Rolling_Stones
- `music-s0008`: Encyclopaedia Britannica, https://www.britannica.com/topic/the-Rolling-Stones
- `music-s0009`: Wikipedia, https://en.wikipedia.org/wiki/Led_Zeppelin
- `music-s0010`: Encyclopaedia Britannica, https://www.britannica.com/topic/Led-Zeppelin
- `music-s0011`: Wikipedia, https://en.wikipedia.org/wiki/Nirvana_(band)
- `music-s0012`: Encyclopaedia Britannica, https://kids.britannica.com/scholars/article/Nirvana/105679
- `music-s0013`: Wikipedia, https://en.wikipedia.org/wiki/Michael_Jackson
- `music-s0014`: Encyclopaedia Britannica, https://www.britannica.com/biography/Michael-Jackson
- `music-s0015`: Wikipedia, https://en.wikipedia.org/wiki/Madonna
- `music-s0016`: Encyclopaedia Britannica, https://www.britannica.com/biography/Madonna-American-singer-and-actress
- `music-s0017`: Wikipedia, https://en.wikipedia.org/wiki/Prince_(musician)
- `music-s0018`: Encyclopaedia Britannica, https://www.britannica.com/biography/Prince-singer-and-songwriter
- `music-s0019`: Wikipedia, https://en.wikipedia.org/wiki/David_Bowie
- `music-s0020`: Encyclopaedia Britannica, https://www.britannica.com/biography/David-Bowie
- `music-s0021`: Wikipedia, https://en.wikipedia.org/wiki/Elton_John
- `music-s0022`: Encyclopaedia Britannica, https://www.britannica.com/biography/Elton-John
- `music-s0023`: Wikipedia, https://en.wikipedia.org/wiki/ABBA
- `music-s0024`: Encyclopaedia Britannica, https://www.britannica.com/topic/ABBA
- `music-s0025`: Wikipedia, https://en.wikipedia.org/wiki/Dolly_Parton
- `music-s0026`: Encyclopaedia Britannica, https://www.britannica.com/biography/Dolly-Parton
- `music-s0027`: Wikipedia, https://en.wikipedia.org/wiki/Johnny_Cash
- `music-s0028`: Encyclopaedia Britannica, https://www.britannica.com/biography/Johnny-Cash
- `music-s0029`: Wikipedia, https://en.wikipedia.org/wiki/Louis_Armstrong
- `music-s0030`: Encyclopaedia Britannica, https://www.britannica.com/biography/Louis-Armstrong
- `music-s0031`: Wikipedia, https://en.wikipedia.org/wiki/Duke_Ellington
- `music-s0032`: Encyclopaedia Britannica, https://www.britannica.com/biography/Duke-Ellington
- `music-s0033`: Wikipedia, https://en.wikipedia.org/wiki/Aretha_Franklin
- `music-s0034`: Encyclopaedia Britannica, https://www.britannica.com/biography/Aretha-Franklin
- `music-s0035`: Wikipedia, https://en.wikipedia.org/wiki/Wolfgang_Amadeus_Mozart
- `music-s0036`: Encyclopaedia Britannica, https://www.britannica.com/biography/Wolfgang-Amadeus-Mozart
- `music-s0037`: Wikipedia, https://en.wikipedia.org/wiki/Ludwig_van_Beethoven
- `music-s0038`: Encyclopaedia Britannica, https://www.britannica.com/summary/Ludwig-van-Beethoven
- `music-s0039`: Wikipedia, https://en.wikipedia.org/wiki/Johann_Sebastian_Bach
- `music-s0040`: Encyclopaedia Britannica, https://www.britannica.com/biography/Johann-Sebastian-Bach
- `music-s0041`: Wikipedia, https://en.wikipedia.org/wiki/Pyotr_Ilyich_Tchaikovsky
- `music-s0042`: Encyclopaedia Britannica, https://www.britannica.com/biography/Pyotr-Ilyich-Tchaikovsky
- `music-s0043`: Wikipedia, https://en.wikipedia.org/wiki/Taylor_Swift
- `music-s0044`: Encyclopaedia Britannica, https://www.britannica.com/biography/Taylor-Swift
- `music-s0045`: Wikipedia, https://en.wikipedia.org/wiki/Beyonc%C3%A9
- `music-s0046`: Encyclopaedia Britannica, https://www.britannica.com/biography/Beyonce
- `music-s0047`: Wikipedia, https://en.wikipedia.org/wiki/Bob_Dylan
- `music-s0048`: Encyclopaedia Britannica, https://www.britannica.com/biography/Bob-Dylan
- `music-s0049`: Wikipedia, https://en.wikipedia.org/wiki/Tupac_Shakur
- `music-s0050`: Encyclopaedia Britannica, https://www.britannica.com/biography/Tupac-Shakur
- `music-s5031`: Wikipedia, https://en.wikipedia.org/wiki/Duke_Ellington
- `music-s5032`: Encyclopaedia Britannica, https://www.britannica.com/biography/Duke-Ellington
- `science-space-s0001`: Wikipedia contributors, https://en.wikipedia.org/wiki/List_of_chemical_elements
- `science-space-s0002`: Los Alamos National Laboratory, https://periodic.lanl.gov/list.shtml
- `science-space-s0003`: Wikipedia contributors, https://en.wikipedia.org/wiki/SI_derived_unit
- `science-space-s0005`: National Institute of Standards and Technology, https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-4-two-classes-si-units-and-si-prefixes
- `science-space-s0006`: NASA Science, https://science.nasa.gov/solar-system/solar-system-facts/
- `science-space-s0007`: OpenStax, Rice University, https://openstax.org/books/astronomy-2e/pages/7-1-overview-of-our-planetary-system
- `science-space-s0010`: NASA Science, https://science.nasa.gov/venus/facts/
- `science-space-s0011`: OpenStax, Rice University, https://openstax.org/books/astronomy-2e/pages/10-1-the-nearest-planets-an-overview
- `science-space-s0013`: OpenStax, Rice University, https://openstax.org/books/astronomy-2e/pages/11-1-exploring-the-outer-planets
- `science-space-s0014`: NASA Science, https://science.nasa.gov/neptune/facts/
- `science-space-s0017`: NASA Science, https://science.nasa.gov/saturn/facts/
- `science-space-s0018`: OpenStax, Rice University, https://openstax.org/books/astronomy-2e/pages/11-2-the-giant-planets
- `science-space-s0019`: NASA Science, https://science.nasa.gov/uranus/facts/
- `science-space-s0020`: NASA Science, https://science.nasa.gov/mars/facts/
- `science-space-s0021`: OpenStax, Rice University, https://openstax.org/books/astronomy-2e/pages/10-4-the-geology-of-mars
- `science-space-s0022`: NASA Science, https://science.nasa.gov/dwarf-planets/pluto/facts/
- `science-space-s0023`: NASA Science, https://science.nasa.gov/dwarf-planets/ceres/facts/
- `science-space-s0024`: OpenStax, Rice University, https://openstax.org/books/university-physics-volume-1/pages/1-2-units-and-standards
- `sports-games-s0001`: Encyclopaedia Britannica, https://www.britannica.com/sports/football-soccer
- `sports-games-s0002`: Wikipedia contributors, https://en.wikipedia.org/wiki/Association_football
- `sports-games-s0003`: Encyclopaedia Britannica, https://www.britannica.com/sports/basketball
- `sports-games-s0004`: Wikipedia contributors, https://en.wikipedia.org/wiki/Basketball
- `sports-games-s0005`: Encyclopaedia Britannica, https://www.britannica.com/sports/baseball
- `sports-games-s0006`: Wikipedia contributors, https://en.wikipedia.org/wiki/Baseball
- `sports-games-s0009`: Encyclopaedia Britannica, https://www.britannica.com/sports/tennis
- `sports-games-s0010`: Wikipedia contributors, https://en.wikipedia.org/wiki/Tennis
- `sports-games-s0011`: Encyclopaedia Britannica, https://www.britannica.com/sports/volleyball
- `sports-games-s0012`: Wikipedia contributors, https://en.wikipedia.org/wiki/Volleyball
- `sports-games-s0013`: Encyclopaedia Britannica, https://www.britannica.com/sports/ice-hockey
- `sports-games-s0014`: Wikipedia contributors, https://en.wikipedia.org/wiki/Ice_hockey
- `sports-games-s0015`: Encyclopaedia Britannica, https://www.britannica.com/sports/badminton
- `sports-games-s0016`: Wikipedia contributors, https://en.wikipedia.org/wiki/Badminton
- `sports-games-s0017`: Encyclopaedia Britannica, https://www.britannica.com/sports/cricket-sport
- `sports-games-s0018`: Wikipedia contributors, https://en.wikipedia.org/wiki/Cricket
- `sports-games-s0019`: Encyclopaedia Britannica, https://www.britannica.com/sports/table-tennis
- `sports-games-s0020`: Wikipedia contributors, https://en.wikipedia.org/wiki/Table_tennis
- `sports-games-s0021`: Encyclopaedia Britannica, https://www.britannica.com/sports/rugby
- `sports-games-s0022`: Wikipedia contributors, https://en.wikipedia.org/wiki/Rugby_union
- `sports-games-s0024`: Wikipedia contributors, https://en.wikipedia.org/wiki/Golf
- `sports-games-s0032`: Wikipedia contributors, https://en.wikipedia.org/wiki/Fencing
- `sports-games-s0033`: Encyclopaedia Britannica, https://www.britannica.com/sports/judo
- `sports-games-s0034`: Wikipedia contributors, https://en.wikipedia.org/wiki/Judo
- `sports-games-s0036`: Wikipedia contributors, https://en.wikipedia.org/wiki/Archery
- `sports-games-s0037`: Encyclopaedia Britannica, https://www.britannica.com/sports/curling
- `sports-games-s0038`: Wikipedia contributors, https://en.wikipedia.org/wiki/Curling
- `sports-games-s0040`: Wikipedia contributors, https://en.wikipedia.org/wiki/Ten-pin_bowling
- `sports-games-s0041`: Encyclopaedia Britannica, https://www.britannica.com/topic/chess
- `sports-games-s0042`: Wikipedia contributors, https://en.wikipedia.org/wiki/Chess
- `sports-games-s0043`: Encyclopaedia Britannica, https://www.britannica.com/topic/go-game
- `sports-games-s0044`: Wikipedia contributors, https://en.wikipedia.org/wiki/Go_(game)
- `sports-games-s0045`: Encyclopaedia Britannica, https://www.britannica.com/sports/Monopoly-board-game
- `sports-games-s0046`: Wikipedia contributors, https://en.wikipedia.org/wiki/Monopoly_(game)
- `sports-games-s0047`: Encyclopaedia Britannica, https://www.britannica.com/sports/Scrabble
- `sports-games-s0048`: Wikipedia contributors, https://en.wikipedia.org/wiki/Scrabble
- `sports-games-s0049`: Encyclopaedia Britannica, https://www.britannica.com/sports/Olympic-Games
- `sports-games-s0050`: Wikipedia contributors, https://en.wikipedia.org/wiki/Olympic_Games
- `sports-games-s0053`: Encyclopaedia Britannica, https://www.britannica.com/sports/golf/Play-of-the-game
- `sports-games-s0055`: Encyclopaedia Britannica, https://www.britannica.com/sports/swimming-sport/Strokes
- `sports-games-s0059`: Encyclopaedia Britannica, https://www.britannica.com/sports/boxing/The-Queensberry-rules
- `sports-games-s0061`: Encyclopaedia Britannica, https://www.britannica.com/sports/heptathlon
- `sports-games-s0062`: Encyclopaedia Britannica, https://www.britannica.com/sports/steeplechase-athletics
- `sports-games-s0063`: Encyclopaedia Britannica, https://www.britannica.com/sports/marathon-race
- `sports-games-s0064`: Wikipedia contributors, https://en.wikipedia.org/wiki/Marathon
- `sports-games-s0066`: Wikipedia contributors, https://en.wikipedia.org/wiki/Heptathlon
- `sports-games-s0067`: Wikipedia contributors, https://en.wikipedia.org/wiki/Steeplechase_(athletics)
- `sports-games-s0069`: Encyclopaedia Britannica, https://www.britannica.com/sports/fencing/Organized-sport
- `sports-games-s0070`: Encyclopaedia Britannica, https://www.britannica.com/sports/archery/Equipment
- `sports-games-s0071`: Encyclopaedia Britannica, https://www.britannica.com/sports/bowling/Play-of-the-game
- `sports-games-s0072`: Wikipedia contributors, https://en.wikipedia.org/wiki/Backstroke
- `sports-games-s0073`: Wikipedia contributors, https://en.wikipedia.org/wiki/Butterfly_stroke
- `sports-games-s0079`: World Boxing Association, https://www.wbaboxing.com/boxing-news/160-years-of-the-queensberry-rules-the-code-that-shaped-boxing-history
- `sports-games-s0080`: International Judo Federation, https://www.ijf.org/history/judo-what-is-it-all-about
- `sports-games-s0081`: International Judo Federation, https://www.ijf.org/history
- `sports-games-s0082`: World History Encyclopedia, https://www.worldhistory.org/Olympic_Games/
- `sports-games-s5025`: Encyclopaedia Britannica, https://www.britannica.com/sports/swimming-sport
- `sports-games-s5026`: Wikipedia contributors, https://en.wikipedia.org/wiki/Swimming_(sport)
- `us-geography-s0001`: Wikipedia contributors, https://en.wikipedia.org/wiki/List_of_states_and_territories_of_the_United_States
- `us-geography-s0002`: State Symbols USA, https://statesymbolsusa.org/symbol-official-item/national-us/state-capital/state-capitals-and-websites
- `us-geography-s0003`: Congressional Research Service / Library of Congress, https://www.congress.gov/crs-product/R47747
- `us-geography-s0004`: National Park Service, https://www.nps.gov/acad/index.htm
- `us-geography-s0005`: Encyclopaedia Britannica, https://www.britannica.com/place/Acadia-National-Park
- `us-geography-s0010`: National Park Service, https://www.nps.gov/bibe/index.htm
- `us-geography-s0011`: Encyclopaedia Britannica, https://www.britannica.com/place/Big-Bend-National-Park
- `us-geography-s0016`: National Park Service, https://www.nps.gov/crla/index.htm
- `us-geography-s0017`: Encyclopaedia Britannica, https://www.britannica.com/place/Crater-Lake-Oregon
- `us-geography-s0020`: National Park Service, https://www.nps.gov/ever/index.htm
- `us-geography-s0021`: Encyclopaedia Britannica, https://www.britannica.com/place/Everglades-National-Park
- `us-geography-s0024`: National Park Service, https://www.nps.gov/grca/index.htm
- `us-geography-s0025`: Encyclopaedia Britannica, https://www.britannica.com/place/Grand-Canyon-National-Park
- `us-geography-s0028`: National Park Service, https://www.nps.gov/grba/index.htm
- `us-geography-s0029`: Encyclopaedia Britannica, https://www.britannica.com/place/Great-Basin-National-Park
- `us-geography-s0036`: National Park Service, https://www.nps.gov/jotr/index.htm
- `us-geography-s0037`: Encyclopaedia Britannica, https://www.britannica.com/place/Joshua-Tree-National-Park
- `us-geography-s0040`: National Park Service, https://www.nps.gov/meve/index.htm
- `us-geography-s0041`: Encyclopaedia Britannica, https://www.britannica.com/place/Mesa-Verde-National-Park
- `us-geography-s0042`: National Park Service, https://www.nps.gov/mora/index.htm
- `us-geography-s0043`: Encyclopaedia Britannica, https://www.britannica.com/place/Mount-Rainier-National-Park
- `us-geography-s0046`: National Park Service, https://www.nps.gov/pefo/index.htm
- `us-geography-s0047`: Encyclopaedia Britannica, https://www.britannica.com/place/Petrified-Forest-National-Park
- `us-geography-s0052`: National Park Service, https://www.nps.gov/zion/index.htm
- `us-geography-s0053`: Encyclopaedia Britannica, https://www.britannica.com/place/Zion-National-Park
- `us-history-civics-s0001`: Encyclopaedia Britannica, https://www.britannica.com/topic/Declaration-of-Independence
- `us-history-civics-s0002`: Wikipedia contributors, https://en.wikipedia.org/wiki/United_States_Declaration_of_Independence
- `us-history-civics-s0003`: Encyclopaedia Britannica, https://www.britannica.com/topic/Constitution-of-the-United-States-of-America
- `us-history-civics-s0004`: Wikipedia contributors, https://en.wikipedia.org/wiki/Constitution_of_the_United_States
- `us-history-civics-s0005`: Encyclopaedia Britannica, https://www.britannica.com/topic/Bill-of-Rights-United-States-Constitution
- `us-history-civics-s0006`: Wikipedia contributors, https://en.wikipedia.org/wiki/United_States_Bill_of_Rights
- `us-history-civics-s0007`: Encyclopaedia Britannica, https://www.britannica.com/topic/Supreme-Court-of-the-United-States
- `us-history-civics-s0008`: Wikipedia contributors, https://en.wikipedia.org/wiki/Supreme_Court_of_the_United_States
- `us-history-civics-s0009`: Encyclopaedia Britannica, https://www.britannica.com/topic/Senate-United-States-government
- `us-history-civics-s0010`: Wikipedia contributors, https://en.wikipedia.org/wiki/United_States_Senate
- `us-history-civics-s0011`: Encyclopaedia Britannica, https://www.britannica.com/topic/House-of-Representatives-United-States-government
- `us-history-civics-s0012`: Wikipedia contributors, https://en.wikipedia.org/wiki/United_States_House_of_Representatives
- `us-history-civics-s0013`: Encyclopaedia Britannica, https://www.britannica.com/topic/Electoral-College-United-States
- `us-history-civics-s0014`: Wikipedia contributors, https://en.wikipedia.org/wiki/United_States_Electoral_College
- `us-history-civics-s0015`: Encyclopaedia Britannica, https://www.britannica.com/event/Louisiana-Purchase
- `us-history-civics-s0017`: Encyclopaedia Britannica, https://www.britannica.com/event/Lewis-and-Clark-Expedition
- `us-history-civics-s0018`: Wikipedia contributors, https://en.wikipedia.org/wiki/Lewis_and_Clark_Expedition
- `us-history-civics-s0019`: Encyclopaedia Britannica, https://www.britannica.com/event/American-Civil-War
- `us-history-civics-s0020`: Wikipedia contributors, https://en.wikipedia.org/wiki/American_Civil_War
- `us-history-civics-s0021`: Encyclopaedia Britannica, https://www.britannica.com/event/Emancipation-Proclamation
- `us-history-civics-s0022`: Wikipedia contributors, https://en.wikipedia.org/wiki/Emancipation_Proclamation
- `us-history-civics-s0023`: Encyclopaedia Britannica, https://www.britannica.com/event/Battle-of-Gettysburg
- `us-history-civics-s0024`: Wikipedia contributors, https://en.wikipedia.org/wiki/Battle_of_Gettysburg
- `us-history-civics-s0029`: Encyclopaedia Britannica, https://www.britannica.com/biography/Benjamin-Franklin
- `us-history-civics-s0030`: Wikipedia contributors, https://en.wikipedia.org/wiki/Benjamin_Franklin
- `us-history-civics-s0031`: Encyclopaedia Britannica, https://www.britannica.com/biography/Harriet-Tubman
- `us-history-civics-s0032`: Wikipedia contributors, https://en.wikipedia.org/wiki/Harriet_Tubman
- `us-history-civics-s0033`: Encyclopaedia Britannica, https://www.britannica.com/biography/Frederick-Douglass
- `us-history-civics-s0034`: Wikipedia contributors, https://en.wikipedia.org/wiki/Frederick_Douglass
- `us-history-civics-s0035`: Encyclopaedia Britannica, https://www.britannica.com/biography/Susan-B-Anthony
- `us-history-civics-s0036`: Wikipedia contributors, https://en.wikipedia.org/wiki/Susan_B._Anthony
- `us-history-civics-s0037`: Encyclopaedia Britannica, https://www.britannica.com/topic/Nineteenth-Amendment
- `us-history-civics-s0038`: Wikipedia contributors, https://en.wikipedia.org/wiki/Nineteenth_Amendment_to_the_United_States_Constitution
- `us-history-civics-s0039`: Encyclopaedia Britannica, https://www.britannica.com/event/Prohibition-United-States-history-1920-1933
- `us-history-civics-s0041`: Encyclopaedia Britannica, https://www.britannica.com/event/New-Deal
- `us-history-civics-s0042`: Wikipedia contributors, https://en.wikipedia.org/wiki/New_Deal
- `us-history-civics-s0043`: Encyclopaedia Britannica, https://www.britannica.com/event/Pearl-Harbor-attack
- `us-history-civics-s0044`: Wikipedia contributors, https://en.wikipedia.org/wiki/Attack_on_Pearl_Harbor
- `us-history-civics-s0045`: Encyclopaedia Britannica, https://www.britannica.com/event/Brown-v-Board-of-Education-of-Topeka
- `us-history-civics-s0046`: Wikipedia contributors, https://en.wikipedia.org/wiki/Brown_v._Board_of_Education
- `us-history-civics-s0047`: Encyclopaedia Britannica, https://www.britannica.com/event/Civil-Rights-Act-United-States-1964
- `us-history-civics-s0048`: Wikipedia contributors, https://en.wikipedia.org/wiki/Civil_Rights_Act_of_1964
- `us-history-civics-s0049`: Encyclopaedia Britannica, https://www.britannica.com/topic/Apollo-11
- `us-history-civics-s0050`: Wikipedia contributors, https://en.wikipedia.org/wiki/Apollo_11
- `us-history-civics-s0051`: Encyclopaedia Britannica, https://www.britannica.com/topic/Thirteenth-Amendment
- `us-history-civics-s0052`: U.S. Department of State, Office of the Historian, https://history.state.gov/milestones/1801-1829/louisiana-purchase
- `us-history-civics-s0060`: Federal Judicial Center, https://www.fjc.gov/history/exhibits/prohibition-in-federal-courts-timeline
- `world-geography-s0001`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/252/
- `world-geography-s0002`: Wikipedia contributors, https://en.wikipedia.org/wiki/Taj_Mahal
- `world-geography-s0003`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/438/
- `world-geography-s0004`: Wikipedia contributors, https://en.wikipedia.org/wiki/Great_Wall_of_China
- `world-geography-s0005`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/274/
- `world-geography-s0006`: Wikipedia contributors, https://en.wikipedia.org/wiki/Machu_Picchu
- `world-geography-s0007`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/326/
- `world-geography-s0008`: Wikipedia contributors, https://en.wikipedia.org/wiki/Petra
- `world-geography-s0009`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/86/
- `world-geography-s0010`: Wikipedia contributors, https://en.wikipedia.org/wiki/Giza_pyramid_complex
- `world-geography-s0011`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/668/
- `world-geography-s0013`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/404/
- `world-geography-s0014`: Wikipedia contributors, https://en.wikipedia.org/wiki/Acropolis_of_Athens
- `world-geography-s0015`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/91/
- `world-geography-s0017`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/373/
- `world-geography-s0018`: Wikipedia contributors, https://en.wikipedia.org/wiki/Stonehenge
- `world-geography-s0021`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/715/
- `world-geography-s0022`: Wikipedia contributors, https://en.wikipedia.org/wiki/Easter_Island
- `world-geography-s0023`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/156/
- `world-geography-s0024`: Wikipedia contributors, https://en.wikipedia.org/wiki/Serengeti_National_Park
- `world-geography-s0025`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/1/
- `world-geography-s0026`: Wikipedia contributors, https://en.wikipedia.org/wiki/Gal%C3%A1pagos_Islands
- `world-geography-s0027`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/154/
- `world-geography-s0028`: Wikipedia contributors, https://en.wikipedia.org/wiki/Great_Barrier_Reef
- `world-geography-s0031`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/509/
- `world-geography-s0032`: Wikipedia contributors, https://en.wikipedia.org/wiki/Victoria_Falls
- `world-geography-s0033`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/403/
- `world-geography-s0034`: Wikipedia contributors, https://en.wikipedia.org/wiki/Mount_Kilimanjaro
- `world-geography-s0035`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/1418/
- `world-geography-s0036`: Wikipedia contributors, https://en.wikipedia.org/wiki/Mount_Fuji
- `world-geography-s0037`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/120/
- `world-geography-s0038`: Wikipedia contributors, https://en.wikipedia.org/wiki/Mount_Everest
- `world-geography-s0039`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/754/
- `world-geography-s0040`: Wikipedia contributors, https://en.wikipedia.org/wiki/Lake_Baikal
- `world-geography-s0043`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/357/
- `world-geography-s0045`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/394/
- `world-geography-s0046`: Wikipedia contributors, https://en.wikipedia.org/wiki/Venice
- `world-geography-s0049`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/98/
- `world-geography-s0050`: Wikipedia contributors, https://en.wikipedia.org/wiki/Plitvice_Lakes_National_Park
- `world-geography-s0051`: Egyptian Ministry of Tourism and Antiquities, https://egymonuments.gov.eg/archaeological-sites/giza-plateau/
- `world-geography-s0052`: Wikipedia contributors, https://en.wikipedia.org/wiki/Rome
- `world-geography-s0053`: Wikipedia contributors, https://en.wikipedia.org/wiki/Angkor
- `world-geography-s0054`: Encyclopaedia Britannica, https://www.britannica.com/place/Cappadocia
- `world-geography-s0056`: Encyclopaedia Britannica, https://www.britannica.com/place/Amazon-Rainforest
- `world-geography-s0059`: National Geographic Kids, https://www.natgeokids.com/uk/discover/geography/physical-geography/amazon-facts/
- `world-geography-s0060`: National Geographic Society, https://blog.education.nationalgeographic.org/2024/09/10/beyond-the-canopy-exploring-the-amazon-from-the-andes-to-the-atlantic/
- `world-geography-s0061`: National Geographic Society, https://education.nationalgeographic.org/resource/amazon-rainforest/
- `world-geography-s0069`: Encyclopaedia Britannica, https://www.britannica.com/topic/Stonehenge
- `world-geography-s0072`: Plitvice Lakes National Park, https://np-plitvicka-jezera.hr/en/about-the-park/general-information/
- `world-geography-s0075`: Plitvice Lakes National Park, https://np-plitvicka-jezera.hr/en/natural-and-cultural-heritage/natural-heritage/karst-landscape/
- `world-geography-s5005`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/274/
- `world-geography-s5006`: Wikipedia contributors, https://en.wikipedia.org/wiki/Machu_Picchu
- `world-geography-s5019`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/166/
- `world-geography-s5020`: Wikipedia contributors, https://en.wikipedia.org/wiki/Sydney_Opera_House
- `world-geography-s5035`: UNESCO World Heritage Centre, https://whc.unesco.org/en/list/1418/
- `world-geography-s5036`: Wikipedia contributors, https://en.wikipedia.org/wiki/Mount_Fuji
- `world-history-s0002`: World History Encyclopedia, https://www.worldhistory.org/Code_of_Hammurabi/
- `world-history-s0003`: Encyclopaedia Britannica, https://www.britannica.com/biography/Augustus-Roman-emperor
- `world-history-s0004`: World History Encyclopedia, https://www.worldhistory.org/augustus/
- `world-history-s0005`: Encyclopaedia Britannica, https://www.britannica.com/biography/Alexander-the-Great
- `world-history-s0006`: World History Encyclopedia, https://www.worldhistory.org/Alexander_the_Great/
- `world-history-s0007`: Encyclopaedia Britannica, https://www.britannica.com/biography/Cleopatra-queen-of-Egypt
- `world-history-s0008`: World History Encyclopedia, https://www.worldhistory.org/Cleopatra_VII/
- `world-history-s0009`: Encyclopaedia Britannica, https://www.britannica.com/biography/Qin-Shi-Huang
- `world-history-s0010`: World History Encyclopedia, https://www.worldhistory.org/Shi_Huangdi/
- `world-history-s0011`: Encyclopaedia Britannica, https://www.britannica.com/biography/Genghis-Khan
- `world-history-s0012`: World History Encyclopedia, https://www.worldhistory.org/Genghis_Khan/
- `world-history-s0013`: Encyclopaedia Britannica, https://www.britannica.com/topic/Magna-Carta
- `world-history-s0014`: World History Encyclopedia, https://www.worldhistory.org/Magna_Carta/
- `world-history-s0015`: Encyclopaedia Britannica, https://www.britannica.com/biography/Ashoka
- `world-history-s0016`: World History Encyclopedia, https://www.worldhistory.org/Ashoka_the_Great/
- `world-history-s0017`: Encyclopaedia Britannica, https://www.britannica.com/biography/Shah-Jahan
- `world-history-s0019`: Encyclopaedia Britannica, https://www.britannica.com/biography/Constantine-I-Roman-emperor
- `world-history-s0020`: World History Encyclopedia, https://www.worldhistory.org/Constantine_I/
- `world-history-s0021`: Encyclopaedia Britannica, https://www.britannica.com/biography/Napoleon-I
- `world-history-s0022`: World History Encyclopedia, https://www.worldhistory.org/Napoleon_Bonaparte/
- `world-history-s0023`: Encyclopaedia Britannica, https://www.britannica.com/biography/Johannes-Gutenberg
- `world-history-s0024`: World History Encyclopedia, https://www.worldhistory.org/Johannes_Gutenberg/
- `world-history-s0025`: Encyclopaedia Britannica, https://www.britannica.com/biography/Martin-Luther
- `world-history-s0026`: World History Encyclopedia, https://www.worldhistory.org/Martin_Luther/
- `world-history-s0027`: Encyclopaedia Britannica, https://www.britannica.com/biography/Henry-VIII-king-of-England
- `world-history-s0028`: World History Encyclopedia, https://www.worldhistory.org/Henry_VIII_of_England/
- `world-history-s0029`: Encyclopaedia Britannica, https://www.britannica.com/biography/Elizabeth-I
- `world-history-s0030`: World History Encyclopedia, https://www.worldhistory.org/Elizabeth_I_of_England/
- `world-history-s0031`: Encyclopaedia Britannica, https://www.britannica.com/biography/Saint-Joan-of-Arc
- `world-history-s0032`: World History Encyclopedia, https://www.worldhistory.org/Joan_of_Arc/
- `world-history-s0033`: Encyclopaedia Britannica, https://www.britannica.com/biography/Charlemagne
- `world-history-s0034`: World History Encyclopedia, https://www.worldhistory.org/Charlemagne/
- `world-history-s0035`: Encyclopaedia Britannica, https://www.britannica.com/biography/Marco-Polo
- `world-history-s0036`: World History Encyclopedia, https://www.worldhistory.org/Marco_Polo/
- `world-history-s0037`: Encyclopaedia Britannica, https://www.britannica.com/event/Black-Death
- `world-history-s0038`: World History Encyclopedia, https://www.worldhistory.org/Black_Death/
- `world-history-s0040`: World History Encyclopedia, https://www.worldhistory.org/French_Revolution/
- `world-history-s0041`: Encyclopaedia Britannica, https://www.britannica.com/biography/Mehmed-II-Ottoman-sultan
- `world-history-s0043`: Encyclopaedia Britannica, https://www.britannica.com/topic/Code-of-Hammurabi
- `world-history-s0044`: World History Encyclopedia, https://www.worldhistory.org/Taj_Mahal/
- `world-history-s0045`: Encyclopaedia Britannica, https://www.britannica.com/biography/Cyrus-the-Great
- `world-history-s0046`: World History Encyclopedia, https://www.worldhistory.org/Cyrus_the_Great/
- `world-history-s0047`: Encyclopaedia Britannica, https://www.britannica.com/biography/Justinian-I
- `world-history-s0048`: World History Encyclopedia, https://www.worldhistory.org/Justinian_I/
- `world-history-s0049`: Encyclopaedia Britannica, https://www.britannica.com/biography/Musa-I-of-Mali
- `world-history-s0050`: World History Encyclopedia, https://www.worldhistory.org/Mansa_Musa_I/
- `world-history-s0051`: Encyclopaedia Britannica, https://www.britannica.com/biography/Leonardo-da-Vinci
- `world-history-s0052`: World History Encyclopedia, https://www.worldhistory.org/Leonardo_da_Vinci/
- `world-history-s0054`: Encyclopaedia Britannica, https://www.britannica.com/event/French-Revolution/Counterrevolution-regicide-and-the-Reign-of-Terror
- `world-history-s0055`: Encyclopaedia Britannica, https://www.britannica.com/topic/Taj-Mahal
- `world-history-s0060`: Gale, Encyclopedia of World Biography (hosted by Encyclopedia.com), https://www.encyclopedia.com/history/encyclopedias-almanacs-transcripts-and-maps/mohammed-ii
- `world-history-s5009`: Encyclopaedia Britannica, https://www.britannica.com/biography/Qin-Shi-Huang
- `world-history-s5010`: World History Encyclopedia, https://www.worldhistory.org/Shi_Huangdi/

## Name Your Baby (T-0714)

`content/name-your-baby.json` is built from the US Social Security Administration's national baby-name file, carried over from partybox-content-packs PR #1 (`job/C05-name-your-baby`, commit `e24f2969`, `data/name-your-baby.json`; the PR's `SOURCES.md:99` records the declaration). Source: `https://www.ssa.gov/oact/babynames/names.zip`, read live by the PR job on 2026-10-07 (7,860,026 bytes, SHA-256 `cd78e975ed7bb358e018dd62fbe14ced89295e9581c49172ca4eedcb011b3724`; dataset US-GOV-SSA-338; 146 annual files, 1880–2025). The PR kept that archive at `jobs/C05-name-your-baby/fixtures/ssa-names-2026-10-07.zip`; this session re-hashed it (same SHA-256) and re-derived every row's decade totals from its yob files, with no differences. The SSA catalogue (`https://www.ssa.gov/data/data.json`, US-GOV-SSA-338) declares this distribution CC0, as the PR job recorded it on 2026-10-07 (its `SOURCES.md:99`). Used: names, sexes and decade totals. Not used: the PR's `fact` texts, its `factReferences` quotes (Behind the Name, Britannica, BabyNames.com, Nameberry), its reviewer notes, its pipeline, CLIs, Python and `VERIFY.md`.

The answers are the highest published decade totals, so they inherit SSA's limits: names under five are omitted, pre-1937 applications are incomplete, and the counts cover the 50 states and DC. 36 of the 500 reviewed rows are left out: five peak in the partial 2020s, and 31 would see their 2020–2025 count, scaled to ten years, reach the peak. No question should flip as later years arrive.
