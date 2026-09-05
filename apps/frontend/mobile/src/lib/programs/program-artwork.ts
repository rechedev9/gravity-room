import type { ImageSourcePropType } from 'react-native';

type Artwork = { cover: ImageSourcePropType; thumbnail: ImageSourcePropType };
// Static requires let Metro bundle these images for offline use.
const artwork: Readonly<Record<string, Artwork>> = {
  '531-boring-but-big': {
    cover: require('../../../assets/programs/531-boring-but-big.webp'),
    thumbnail: require('../../../assets/programs/531-boring-but-big-thumb.webp'),
  },
  '531-for-beginners': {
    cover: require('../../../assets/programs/531-for-beginners.webp'),
    thumbnail: require('../../../assets/programs/531-for-beginners-thumb.webp'),
  },
  'caparazon-de-tortuga': {
    cover: require('../../../assets/programs/caparazon-de-tortuga.webp'),
    thumbnail: require('../../../assets/programs/caparazon-de-tortuga-thumb.webp'),
  },
  'furia-oscura': {
    cover: require('../../../assets/programs/furia-oscura.webp'),
    thumbnail: require('../../../assets/programs/furia-oscura-thumb.webp'),
  },
  gzclp: {
    cover: require('../../../assets/programs/gzclp.webp'),
    thumbnail: require('../../../assets/programs/gzclp-thumb.webp'),
  },
  'hexan-ppl': {
    cover: require('../../../assets/programs/hexan-ppl.webp'),
    thumbnail: require('../../../assets/programs/hexan-ppl-thumb.webp'),
  },
  'sala-del-tiempo-1': {
    cover: require('../../../assets/programs/sala-del-tiempo-1.webp'),
    thumbnail: require('../../../assets/programs/sala-del-tiempo-1-thumb.webp'),
  },
  'sala-del-tiempo-2': {
    cover: require('../../../assets/programs/sala-del-tiempo-2.webp'),
    thumbnail: require('../../../assets/programs/sala-del-tiempo-2-thumb.webp'),
  },
  'sala-del-tiempo-3': {
    cover: require('../../../assets/programs/sala-del-tiempo-3.webp'),
    thumbnail: require('../../../assets/programs/sala-del-tiempo-3-thumb.webp'),
  },
  'nivel-7': {
    cover: require('../../../assets/programs/nivel-7.webp'),
    thumbnail: require('../../../assets/programs/nivel-7-thumb.webp'),
  },
  'phraks-greyskull-lp': {
    cover: require('../../../assets/programs/phraks-greyskull-lp.webp'),
    thumbnail: require('../../../assets/programs/phraks-greyskull-lp-thumb.webp'),
  },
  phul: {
    cover: require('../../../assets/programs/phul.webp'),
    thumbnail: require('../../../assets/programs/phul-thumb.webp'),
  },
  'stronglifts-5x5': {
    cover: require('../../../assets/programs/stronglifts-5x5.webp'),
    thumbnail: require('../../../assets/programs/stronglifts-5x5-thumb.webp'),
  },
  'tenkaichi-budokai-peso-muerto': {
    cover: require('../../../assets/programs/tenkaichi-budokai-peso-muerto.webp'),
    thumbnail: require('../../../assets/programs/tenkaichi-budokai-peso-muerto-thumb.webp'),
  },
  'tenkaichi-budokai-press-banca': {
    cover: require('../../../assets/programs/tenkaichi-budokai-press-banca.webp'),
    thumbnail: require('../../../assets/programs/tenkaichi-budokai-press-banca-thumb.webp'),
  },
  'tenkaichi-budokai-sentadilla': {
    cover: require('../../../assets/programs/tenkaichi-budokai-sentadilla.webp'),
    thumbnail: require('../../../assets/programs/tenkaichi-budokai-sentadilla-thumb.webp'),
  },
  'tenkaichi-budokai-solo-banca': {
    cover: require('../../../assets/programs/tenkaichi-budokai-solo-banca.webp'),
    thumbnail: require('../../../assets/programs/tenkaichi-budokai-solo-banca-thumb.webp'),
  },
  'tenkaichi-budokai-veterano': {
    cover: require('../../../assets/programs/tenkaichi-budokai-veterano.webp'),
    thumbnail: require('../../../assets/programs/tenkaichi-budokai-veterano-thumb.webp'),
  },
};

export function getProgramArtwork(programId: string | undefined): Artwork | undefined {
  return programId && Object.hasOwn(artwork, programId) ? artwork[programId] : undefined;
}
