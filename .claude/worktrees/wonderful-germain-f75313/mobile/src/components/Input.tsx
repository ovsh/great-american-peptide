import { TextInput, TextInputProps, View, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../theme';

interface InputProps extends TextInputProps {
  size?: 'md' | 'lg';
}

export function Input({ size = 'md', style, ...rest }: InputProps) {
  return (
    <View>
      <TextInput
        placeholderTextColor={colors.inkSubtle}
        style={[
          styles.input,
          { fontSize: size === 'lg' ? 18 : 16 },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    fontFamily: fonts.sans,
    color: colors.ink,
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    minHeight: 36,
  },
});
