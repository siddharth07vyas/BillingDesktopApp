import { useWindowDimensions } from 'react-native';

/**
 * Size buckets for budget landscape tablets (e.g. 1024×600 panels), where height is the scarce dimension.
 * `compact` = narrow width, `short` = little vertical room once the tab bar is drawn.
 */
export function useScreenSize() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    compact: width < 900,
    short: height < 560,
  };
}
