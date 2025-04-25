// InfoModal.js
import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const { width, height } = Dimensions.get('window');

export default function InfoModal({
  visible,
  checklist,
  onToggleItem,
  onConfirm,
  onClose,
}) {
  const totalPrice = checklist
    .filter(i => i.checked)
    .reduce((sum, i) => sum + i.price, 0);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="times-circle" size={20} color="black" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Selected Services</Text>
          <FlatList
            data={checklist}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.checklistItem}
                onPress={() => onToggleItem(item.id)}
              >
                <View style={styles.checklistRow}>
                  <Text style={styles.checklistText}>{item.text}</Text>
                  <Text style={styles.checklistPrice}>₹{item.price}</Text>
                  <Icon
                    name={item.checked ? 'check-square' : 'square-o'}
                    size={24}
                    color="green"
                  />
                </View>
              </TouchableOpacity>
            )}
          />
          <Text style={styles.totalPrice}>Total Price: ₹{totalPrice}</Text>
          <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
            <Text style={styles.buttonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: width * 0.85, maxHeight: height * 0.7,
    backgroundColor: '#fff', borderRadius: 12, padding: 20,
  },
  closeButton: { position: 'absolute', top: 15, right: 15 },
  modalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 15 },
  checklistItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  checklistRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checklistText: { fontSize: 16, flex: 1 },
  checklistPrice: { fontSize: 16, marginRight: 10, color: 'green' },
  totalPrice: { fontSize: 17, fontWeight: '600', textAlign: 'right', marginTop: 10 },
  confirmButton: {
    marginTop: 15, backgroundColor: '#28a745',
    paddingVertical: 12, borderRadius: 8, alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '500', color: '#fff' },
});
