import { memo, useState } from 'react';
import { Image, Linking, Text as NativeText } from 'react-native';
import { Text, mobileUiColors } from '@studyforge/mobile-ui';
import type { IDocumentBlock } from './documentBlocks';

export function openLink(url: string): void {
  if (/^(https?:|mailto:)/i.test(url))
    void Linking.openURL(url).catch(() => undefined);
}

function DocumentImage({ url, alt }: { url?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || !/^https?:\/\//i.test(url) || failed)
    return (
      <Text tone="muted">
        {alt ? `Image unavailable: ${alt}` : 'Image unavailable'}
      </Text>
    );
  return (
    <Image
      source={{ uri: url }}
      accessibilityLabel={alt || 'Document image'}
      onError={() => setFailed(true)}
      style={{
        width: '100%',
        height: 240,
        resizeMode: 'contain',
        marginVertical: 8,
      }}
    />
  );
}

function ReaderBlockView({
  block,
  textScale = 1,
  highlighted = false,
}: {
  block: IDocumentBlock;
  /** Reader text size multiplier from preferences. */
  textScale?: number;
  /** The narration is reading this block. */
  highlighted?: boolean;
}) {
  if (block.kind === 'image')
    return <DocumentImage url={block.imageUrl} alt={block.alt} />;
  return (
    <NativeText
      style={{
        color:
          block.kind === 'placeholder'
            ? mobileUiColors.mutedForeground
            : mobileUiColors.foreground,
        fontSize:
          (block.kind === 'heading'
            ? Math.max(19, 28 - (block.level ?? 1) * 2)
            : 16) * textScale,
        fontWeight: block.kind === 'heading' ? '700' : '400',
        lineHeight: Math.round(
          (block.kind === 'heading' ? 34 : 25) * textScale,
        ),
        marginVertical: 7,
        marginLeft:
          block.kind === 'list' ? Math.min(48, (block.level ?? 0) * 16) : 0,
        padding:
          block.kind === 'code' || block.kind === 'quote'
            ? 12
            : highlighted
              ? 4
              : 0,
        borderRadius: highlighted ? 8 : 0,
        backgroundColor:
          block.kind === 'code' || highlighted
            ? mobileUiColors.muted
            : 'transparent',
        fontFamily: block.kind === 'code' ? 'monospace' : undefined,
      }}
    >
      {block.kind === 'list' ? '• ' : ''}
      {block.spans.map((span, index) => (
        <NativeText
          key={index}
          onPress={span.href ? () => openLink(span.href ?? '') : undefined}
          style={{
            fontWeight: span.bold ? '700' : undefined,
            fontStyle: span.italic ? 'italic' : undefined,
            fontFamily: span.code ? 'monospace' : undefined,
            color: span.href ? mobileUiColors.accent : undefined,
            textDecorationLine: span.href ? 'underline' : undefined,
          }}
        >
          {span.text}
        </NativeText>
      ))}
    </NativeText>
  );
}

/** Memoized: the reader re-renders twice a second while narration plays. */
export const ReaderBlock = memo(ReaderBlockView);
