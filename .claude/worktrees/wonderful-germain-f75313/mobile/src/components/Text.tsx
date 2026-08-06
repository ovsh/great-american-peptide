import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { colors, text, type TextVariant } from '../theme';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  weight?: '400' | '500' | '600' | '700';
}

export function Text({ variant = 'body', color = colors.ink, align, style, weight, ...rest }: TextProps) {
  return (
    <RNText
      style={[text[variant], { color, textAlign: align, ...(weight ? { fontWeight: weight } : {}) }, style]}
      {...rest}
    />
  );
}
