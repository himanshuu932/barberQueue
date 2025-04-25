// RatingModal.js
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Rating } from 'react-native-ratings';

const { width } = Dimensions.get('window');

export default function RatingModal({
  visible,
  rating,
  onFinishRating,
  onSubmit,
  onClose,
  onReset,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        /* ignore hardware back */
      }}
      onShow={() => console.log('Rating modal is now visible.')}
    >
      <View style={styles.ratingModalContainer}>
        <View style={styles.ratingModalContent}>
          <Text style={styles.ratingModalTitle}>Rate Your Barber</Text>
          <Rating
            type="star"
            ratingCount={5}
            imageSize={40}
            startingValue={rating}
            onFinishRating={onFinishRating}
          />
          <TouchableOpacity
            style={styles.ratingSubmitButton}
            onPress={onSubmit}
          >
            <Text style={styles.ratingSubmitButtonText}>Submit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ratingCloseButton}
            onPress={() => { onReset(); onClose(); }}
          >
            <Text style={styles.ratingCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ratingModalContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  ratingModalContent: {
    width: width * 0.8, backgroundColor: '#fff',
    borderRadius: 12, padding: 20, alignItems: 'center',
  },
  ratingModalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  ratingSubmitButton: {
    backgroundColor: '#28a745', paddingVertical: 12,
    paddingHorizontal: 24, borderRadius: 8, marginTop: 20,
    width: '100%', alignItems: 'center',
  },
  ratingSubmitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  ratingCloseButton: {
    marginTop: 10, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 8, borderWidth: 1, borderColor: '#ccc',
    width: '100%', alignItems: 'center',
  },
  ratingCloseButtonText: { color: '#555', fontSize: 16 },
});
