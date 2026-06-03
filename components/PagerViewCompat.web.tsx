import { View, ScrollView } from 'react-native';
import { forwardRef, useImperativeHandle } from 'react';

// Web fallback for react-native-pager-view (not supported on web)
const PagerViewCompat = forwardRef(({ children, style, initialPage = 0, onPageSelected }: any, ref) => {
  useImperativeHandle(ref, () => ({
    setPage: () => {},
    setPageWithoutAnimation: () => {},
  }));

  const pages = Array.isArray(children) ? children : [children];

  return (
    <ScrollView horizontal pagingEnabled style={style}>
      {pages.map((page: any, i: number) => (
        <View key={i} style={{ flex: 1 }}>
          {page}
        </View>
      ))}
    </ScrollView>
  );
});

PagerViewCompat.displayName = 'PagerViewCompat';

export default PagerViewCompat;
export type PagerViewProps = any;
