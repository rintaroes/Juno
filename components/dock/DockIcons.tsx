import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = {
  color: string;
  size?: number;
  strokeWidth?: number;
};

/** Map — navigation arrow + pin (mock). */
export function DockMapIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 19.5L19.5 4.5M19.5 4.5H12.75M19.5 4.5V11.25"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={7.25}
        cy={16.75}
        r={2.25}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Circle cx={7.25} cy={16.75} r={0.85} fill={color} />
    </Svg>
  );
}

/** Protect — shield outline. */
export function DockProtectIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.25L5.5 5.75V11.25C5.5 15.6 8.35 18.55 12 20.25C15.65 18.55 18.5 15.6 18.5 11.25V5.75L12 3.25Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Roster — spiral notebook + person on cover. */
export function DockRosterIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 4.5H17.5C18.6 4.5 19.5 5.4 19.5 6.5V17.5C19.5 18.6 18.6 19.5 17.5 19.5H9C7.9 19.5 7 18.6 7 17.5V6.5C7 5.4 7.9 4.5 9 4.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M9 4.5V19.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M5.25 7.5H7.25M5.25 10.5H7.25M5.25 13.5H7.25M5.25 16.5H7.25"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx={14.25} cy={10.25} r={1.75} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M11.75 16.25C11.75 14.65 16.75 14.65 16.75 16.25"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Circles — two overlapping people. */
export function DockCirclesIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.5 19.5V17.6C16.5 15.98 15.16 14.65 13.5 14.65H10.5C8.84 14.65 7.5 15.98 7.5 17.6V19.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={8.75} r={2.75} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M19.25 19.5V17.85C19.25 16.62 18.34 15.58 17.1 15.38"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20.35 8.9C21.12 8.9 21.75 8.3 21.75 7.55C21.75 6.8 21.12 6.2 20.35 6.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M4.75 19.5V17.85C4.75 16.62 5.66 15.58 6.9 15.38"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.65 8.9C2.88 8.9 2.25 8.3 2.25 7.55C2.25 6.8 2.88 6.2 3.65 6.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
