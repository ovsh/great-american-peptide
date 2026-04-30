import * as React from 'react';
import { Text } from './Text';
import { colors } from '../theme';

interface EyebrowProps {
  children: React.ReactNode;
  tone?: 'default' | 'accent';
}

export function Eyebrow({ children, tone = 'default' }: EyebrowProps) {
  return (
    <Text variant="eyebrow" color={tone === 'accent' ? colors.red : colors.inkMuted}>
      {children}
    </Text>
  );
}
