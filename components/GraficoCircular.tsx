import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Colors } from '@/constants/theme';

type Props = {
  porcentaje: number;
  sobrepasa: boolean;
  size?: number;
};

export default function GraficoCircular({ porcentaje, sobrepasa, size = 160 }: Props) {
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(porcentaje / 100, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const color = sobrepasa ? Colors.red : Colors.teal;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={Colors.tealLight}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={[styles.texto, { width: size, height: size }]}>
        <Text style={[styles.porcentaje, sobrepasa && { color: Colors.red }]}>
          {Math.round(porcentaje)}%
        </Text>
        <Text style={styles.label}>gastado</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  texto: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  porcentaje: { fontSize: 32, fontWeight: '700', color: Colors.tealDark },
  label: { fontSize: 13, color: Colors.textGray },
});
