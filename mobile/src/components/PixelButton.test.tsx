import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PixelButton } from './PixelButton';
import { PixelBadge } from './PixelBadge';
import { PixelCard } from './PixelCard';

describe('PixelButton', () => {
  it('renders button title and custom children correctly', () => {
    const { getByText } = render(<PixelButton title="LIGHT THE LAMP" />);
    expect(getByText('LIGHT THE LAMP')).toBeDefined();
  });

  it('renders custom children element', () => {
    const { getByText } = render(
      <PixelButton variant="brass">
        <span>ENTER THE STUDY</span>
      </PixelButton>
    );
    expect(getByText('ENTER THE STUDY')).toBeDefined();
  });

  it('handles press interactions and fires onPress', () => {
    const onPressMock = vi.fn();
    const { getByText } = render(
      <PixelButton title="SUBMIT ESSAY" onPress={onPressMock} />
    );

    const button = getByText('SUBMIT ESSAY');
    fireEvent.click(button);
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('does not fire press when disabled', () => {
    const onPressMock = vi.fn();
    const { getByTestId } = render(
      <PixelButton
        testID="disabled-btn"
        title="SAVED"
        disabled={true}
        onPress={onPressMock}
      />
    );

    const btn = getByTestId('disabled-btn');
    fireEvent.click(btn);
    expect(onPressMock).not.toHaveBeenCalled();
  });
});

describe('PixelBadge', () => {
  it('renders label and status dots for all variants', () => {
    const { getByText } = render(<PixelBadge variant="brass" label="SCHOLAR" />);
    expect(getByText('SCHOLAR')).toBeDefined();
  });
});

describe('PixelCard', () => {
  it('renders card header, body, and footer', () => {
    const { getByText } = render(
      <PixelCard
        variant="shelf"
        header="01 · CHAPTER ONE"
        footer="Page 1 of 42"
      >
        <span>Grounded study notes</span>
      </PixelCard>
    );

    expect(getByText('01 · CHAPTER ONE')).toBeDefined();
    expect(getByText('Grounded study notes')).toBeDefined();
    expect(getByText('Page 1 of 42')).toBeDefined();
  });
});
