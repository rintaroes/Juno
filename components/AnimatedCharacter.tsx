import ConcernedCharacter from '../assets/character/concerned.svg';
import DefaultCharacter from '../assets/character/default.svg';
import HeartCharacter from '../assets/character/heart.svg';
import PeekingCharacter from '../assets/character/peeking.svg';
import SettledCharacter from '../assets/character/settled.svg';
import TrioCharacter from '../assets/character/trio.svg';
import TwoCharacter from '../assets/character/two.svg';
import WaveCharacter from '../assets/character/wave.svg';

type AnimatedCharacterProps = {
  variant: string;
  size?: number;
};

function getVariantComponent(variant: string) {
  switch (variant) {
    case 'waving':
    case 'wave':
      return WaveCharacter;
    case 'heart':
      return HeartCharacter;
    case 'two':
      return TwoCharacter;
    case 'peeking':
      return PeekingCharacter;
    case 'concerned':
      return ConcernedCharacter;
    case 'trio':
      return TrioCharacter;
    case 'settled':
      return SettledCharacter;
    case 'default':
    default:
      return DefaultCharacter;
  }
}

export function AnimatedCharacter({ variant, size = 120 }: AnimatedCharacterProps) {
  const Character = getVariantComponent(variant);
  return <Character width={size} height={size} />;
}
