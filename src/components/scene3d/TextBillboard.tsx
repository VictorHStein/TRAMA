import { Billboard, Text } from '@react-three/drei';

interface TextBillboardProps {
  position: [number, number, number];
  text: string;
  color?: string;
  size?: number;
  background?: string;
  outline?: boolean;
  renderOrder?: number;
}

/**
 * Billboard text used for labels in the 3D scene.
 * Always faces the camera so multiple labels never look skewed.
 */
export function TextBillboard({
  position,
  text,
  color = '#e2e8f0',
  size = 0.32,
  outline = true,
  renderOrder = 10,
}: TextBillboardProps) {
  return (
    <Billboard position={position} follow lockX={false} lockY={false} lockZ={false}>
      <Text
        fontSize={size}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={outline ? 0.018 : 0}
        outlineColor="#0F141B"
        outlineOpacity={0.95}
        renderOrder={renderOrder}
        material-toneMapped={false}
        material-depthWrite={false}
      >
        {text}
      </Text>
    </Billboard>
  );
}
