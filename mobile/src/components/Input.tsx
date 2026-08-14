import { useState } from 'react';
import type { Ref } from 'react';
import { Platform, TextInput, View, StyleSheet } from 'react-native';
import type { TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

interface InputProps extends TextInputProps {
  size?: 'md' | 'lg';
  /** Reaches the native field, for a caller that opens the keyboard itself. */
  ref?: Ref<TextInput>;
}

export function Input({ size = 'md', style, onFocus, onBlur, ref, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.inkMuted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          Platform.OS === 'web' && styles.webInput,
          { fontSize: size === 'lg' ? 18 : 16 },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create<{
  field: ViewStyle;
  fieldFocused: ViewStyle;
  input: TextStyle;
  webInput: TextStyle;
}>({
  field: {
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  fieldFocused: {
    borderColor: colors.accent,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sans,
    color: colors.ink,
    paddingVertical: 0,
    paddingHorizontal: 14,
  },
  webInput: {
    outlineWidth: 0,
  },
});
