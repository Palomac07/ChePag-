import { useEffect, useRef, useState } from 'react';
import { ImagenElegida, pickFromCamera, pickFromGallery } from '@/lib/ticketImage';

export function useImagePicker(onPick: (image: ImagenElegida) => void) {
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const [pendingSource, setPendingSource] = useState<'camara' | 'galeria' | null>(null);
  const [pickerActivo, setPickerActivo] = useState(false);
  const [permisoDenegado, setPermisoDenegado] = useState(false);
  const pickerActivoRef = useRef(false);

  const pedirImagen = (origen: 'camara' | 'galeria') => {
    if (pickerActivoRef.current) return;
    setPendingSource(origen);
    setSourceModalVisible(false);
  };

  useEffect(() => {
    if (!pendingSource || sourceModalVisible || pickerActivoRef.current) return;
    let cancelado = false;
    const abrirPicker = async () => {
      pickerActivoRef.current = true;
      setPickerActivo(true);
      try {
        await new Promise(r => setTimeout(r, 650));
        const resultado = pendingSource === 'camara' ? await pickFromCamera() : await pickFromGallery();
        if (!cancelado) {
          if (resultado === 'denied') setPermisoDenegado(true);
          else if (resultado) onPick(resultado);
          setPendingSource(null);
        }
      } finally {
        pickerActivoRef.current = false;
        if (!cancelado) setPickerActivo(false);
      }
    };
    abrirPicker();
    return () => { cancelado = true; };
  }, [pendingSource, sourceModalVisible, onPick]);

  return {
    sourceModalVisible,
    setSourceModalVisible,
    pedirImagen,
    pickerActivo,
    permisoDenegado,
    setPermisoDenegado,
  };
}
