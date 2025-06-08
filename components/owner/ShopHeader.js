// FileName: ShopHeader.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
  Dimensions,
  Platform,
  ActionSheetIOS,
  ActivityIndicator, // Added for loading states
  FlatList, // Added for subscription plans
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview'; // Added for Razorpay checkout

const { width: screenWidth } = Dimensions.get("window");
const API_BASE_URL = 'https://numbr-p7zc.onrender.com/api';
// It's recommended to use environment variables for keys.
const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_5ntRaY7OFb2Rq0'; 

const ShopHeader = ({ shop, userToken, onShopUpdate }) => {
    const [isEditShopModalVisible, setIsEditShopModalVisible] = useState(false);
    const [editedShopData, setEditedShopData] = useState(null);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const carouselScrollViewRef = useRef(null);

    // --- State for the entire subscription renewal flow ---
    const [isSubscriptionModalVisible, setIsSubscriptionModalVisible] = useState(false);
    const [subscriptionPlans, setSubscriptionPlans] = useState([]);
    const [isLoading, setIsLoading] = useState(false); // General loading state for API calls
    const [checkoutUrl, setCheckoutUrl] = useState(null); // URL for the WebView
    const [currentPlan, setCurrentPlan] = useState(null); // To store the selected plan during payment

    useEffect(() => {
        let interval;
        const images = isEditShopModalVisible && editedShopData ? editedShopData.carouselImages : shop?.carouselImages;
        if (images && images.length > 1) {
            interval = setInterval(() => {
                setCarouselIndex(prevIndex => {
                    const nextIndex = (prevIndex + 1) % images.length;
                    carouselScrollViewRef.current?.scrollTo({ x: nextIndex * (screenWidth - 40), animated: true });
                    return nextIndex;
                });
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [shop, editedShopData, isEditShopModalVisible]);

    const handleScroll = (event) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const images = isEditShopModalVisible && editedShopData ? editedShopData.carouselImages : shop?.carouselImages;
        if (images && images.length > 0) {
            const newIndex = Math.round(contentOffsetX / (screenWidth - 40));
            setCarouselIndex(newIndex);
        }
    };
    
    // --- Subscription & Payment Functions ---

    const handlePayNowPress = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/subscriptions`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
            });
            const data = await response.json();
            console.log('ShopHeader: Fetched Subscription Plans:', data);
            if (!response.ok) throw new Error(data.message || 'Could not fetch subscription plans.');
            setSubscriptionPlans(data.data);
            setIsSubscriptionModalVisible(true);
        } catch (error) {
            Alert.alert('Error fetching plans', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectPlan = async (plan) => {
        setIsLoading(true);
        setCurrentPlan(plan);

        // Essential validation for shop and plan
        if (!shop?._id) {
            Alert.alert('Payment Error', 'Shop information is missing. Cannot proceed with payment.');
            setIsLoading(false);
            return;
        }
        if (!plan?._id || typeof plan?.price !== 'number' || plan.price <= 0) {
            Alert.alert('Payment Error', 'Selected plan is invalid or price is missing.');
            setIsLoading(false);
            return;
        }

        try {
            const orderResponse = await fetch(`${API_BASE_URL}/shops/payment/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                body: JSON.stringify({
                    amount: plan.price,
                    currency: 'INR',
                    shopId: shop._id,
                    planId: plan._id,
                }),
            });

            const orderData = await orderResponse.json();
            console.log('ShopHeader: Order Creation Response:', orderData);
            if (!orderResponse.ok) {
                // If the backend returns an error message, use it. Otherwise, a generic message.
                throw new Error(orderData.message || 'Failed to create payment order. Check server logs.');
            }

            const { id: order_id, amount, currency } = orderData.data;

            // Prepare prefill data safely, using existing shop data or sensible defaults
            const prefill_name = shop?.name || 'Shop Owner';
            const prefill_email_val = shop?.owner?.email || 'owner@example.com'; // Assuming owner's email is in shop.owner.email
            const prefill_contact_val = shop?.owner?.phone || '9999999999'; // Assuming owner's phone is in shop.owner.phone


            const checkoutPageUrl = `${API_BASE_URL}/shops/payment/checkout-page`;
            const params = new URLSearchParams({
                order_id,
                key_id: RAZORPAY_KEY_ID,
                amount,
                currency,
                name: prefill_name, // Use safely obtained name
                description: `Subscription for ${plan.name || 'Selected Plan'}`, // Use plan name or fallback
                prefill_email: prefill_email_val, // Use safely obtained email
                prefill_contact: prefill_contact_val, // Use safely obtained contact
                theme_color: '#007BFF',
                shopId: shop._id,
            }).toString();
            
            setCheckoutUrl(`${checkoutPageUrl}?${params}`);
            setIsSubscriptionModalVisible(false); // Close plan selection modal, open WebView
        } catch (error) {
            console.error('ShopHeader: Payment Error in handleSelectPlan:', error);
            Alert.alert('Payment Initiation Error', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleWebViewNavigationStateChange = async (navState) => {
        const { url } = navState;
        if (!url) return;

        console.log('ShopHeader: WebView Navigating to:', url);

        if (url.includes('/shops/payment/webview-callback/success')) {
            setCheckoutUrl(null); // Close WebView immediately on success callback
            
            const urlParams = new URLSearchParams(url.split('?')[1]);
            const paymentDetails = {
                razorpay_payment_id: urlParams.get('razorpay_payment_id'),
                razorpay_order_id: urlParams.get('razorpay_order_id'),
                razorpay_signature: urlParams.get('razorpay_signature'),
                shopId: urlParams.get('shop_id'),
                planId: currentPlan?._id, // Use the stored currentPlan ID
            };

            if (paymentDetails.razorpay_payment_id && paymentDetails.planId) {
                console.log('ShopHeader: Calling verifyPayment with details:', paymentDetails);
                await verifyPayment(paymentDetails);
            } else {
                console.error('ShopHeader: Success callback missing crucial payment or plan details.', paymentDetails);
                Alert.alert('Payment Issue', 'Successful payment but missing verification details. Please contact support.');
            }
        } else if (url.includes('/shops/payment/webview-callback/failure')) {
            setCheckoutUrl(null); // Close WebView on failure callback
            const urlParams = new URLSearchParams(url.split('?')[1]);
            const errorMessage = urlParams.get('description') || 'Payment failed or was cancelled.';
            Alert.alert('Payment Failed', errorMessage);
            console.warn('ShopHeader: WebView Payment Failed:', url);
        }
    };

    const verifyPayment = async (details) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/shops/payment/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                body: JSON.stringify(details),
            });
            
            const data = await response.json();
            console.log('ShopHeader: Payment Verification Response:', data);

            if (!response.ok) {
                throw new Error(data.message || 'Payment verification failed on the server.');
            }

            Alert.alert('Success', 'Subscription updated successfully!');
            // IMPORTANT: Call onShopUpdate to refresh the parent component's shop data
            if (onShopUpdate) await onShopUpdate();
        } catch (error) {
            console.error('ShopHeader: Verification Error:', error);
            Alert.alert('Verification Error', error.message);
        } finally {
            setIsLoading(false);
            setCurrentPlan(null); // Clear the current plan state
        }
    };
    
    // --- Original Functions from your provided file ---

    const handleOpenEditShopModal = () => {
        setEditedShopData(shop ? { ...shop, carouselImages: [...(shop.carouselImages || [])], address: shop.address?.fullDetails || '' } : null);
        setIsEditShopModalVisible(true);
    };

    const handleSaveShopChanges = async () => {
        if (!editedShopData || !userToken) return;
        if (!editedShopData.name || !editedShopData.address || !editedShopData.openingTime || !editedShopData.closingTime) {
            Alert.alert("Validation Error", "All shop fields are required.");
            return;
        }
        try {
            const shopToUpdate = {
                name: editedShopData.name,
                address: { fullDetails: editedShopData.address, coordinates: editedShopData.coordinates || shop?.address?.coordinates || { type: 'Point', coordinates: [-74.0060, 40.7128] } },
                photos: editedShopData.carouselImages,
                openingTime: editedShopData.openingTime,
                closingTime: editedShopData.closingTime,
                isManuallyOverridden: editedShopData.isManuallyOverridden,
                isOpen: editedShopData.isOpen,
            };
            const response = await fetch(`${API_BASE_URL}/shops/${shop._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                body: JSON.stringify(shopToUpdate),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to update shop.');
            }
            Alert.alert("Success", "Shop details updated!");
            setIsEditShopModalVisible(false);
            if (onShopUpdate) await onShopUpdate();
        } catch (err) {
            console.error('Error saving shop:', err);
            Alert.alert("Error", err.message);
        }
    };

    const pickShopImage = async () => {
        const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        if (mediaStatus !== 'granted' || cameraStatus !== 'granted') {
            Alert.alert('Permission Required', 'Please enable camera and media library permissions.');
            return;
        }
        const options = ['Take Photo', 'Choose from Gallery', 'Cancel'];
        const handleSelection = async (idx) => {
            let result;
            if (idx === 0) {
                result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 1 });
            } else if (idx === 1) {
                result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 1 });
            }
            if (result && !result.canceled && result.assets && result.assets.length > 0) {
                setEditedShopData(prev => ({ ...prev, carouselImages: [result.assets[0].uri, ...(prev.carouselImages || [])] }));
            }
        };

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, handleSelection);
        } else {
            Alert.alert('Add Image', 'Choose an option:', options.map((title, i) => ({ text: title, onPress: () => handleSelection(i), style: i === 2 ? 'cancel' : 'default' })), { cancelable: true });
        }
    };

    const handleRemoveShopCarouselImage = (idx) => Alert.alert("Confirm Removal", "Are you sure you want to remove this image?", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", onPress: () => setEditedShopData(prev => ({ ...prev, carouselImages: prev.carouselImages.filter((_, i) => i !== idx) })), style: "destructive" }
    ]);

    const handleToggleShopStatusInEditModal = () => setEditedShopData(prev => ({ ...prev, isOpen: !prev.isOpen, isManuallyOverridden: true }));

    const formatDate = (dateString) => {
        if (!dateString) return null;
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    const calculateDaysRemaining = (endDateString) => {
        if (!endDateString) return 'N/A';
        const endDate = new Date(endDateString);
        const now = new Date();
        const timeDiff = endDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        return daysRemaining > 0 ? `${daysRemaining} days` : 'Expired';
    };

    const displayCarouselImages = isEditShopModalVisible && editedShopData ? editedShopData.carouselImages : shop?.carouselImages;
    
    return (
        <>
            <View style={styles.card}>
                {displayCarouselImages && displayCarouselImages.length > 0 ? (
                    <>
                        <ScrollView
                            ref={carouselScrollViewRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            style={styles.carouselContainer}
                            onScroll={handleScroll}
                            scrollEventThrottle={16}
                        >
                            {displayCarouselImages.map((imgUrl, idx) => (
                                <Image
                                    key={idx.toString()}
                                    source={{ uri: imgUrl }}
                                    style={[styles.carouselImage, { width: screenWidth - 40 }]}
                                    resizeMode="cover"
                                />
                            ))}
                        </ScrollView>
                        <View style={styles.paginationDotsContainer}>
                            {displayCarouselImages.map((_, idx) => (
                                <View
                                    key={idx.toString()}
                                    style={[
                                        styles.paginationDot,
                                        carouselIndex === idx && styles.paginationDotActive
                                    ]}
                                />
                            ))}
                        </View>
                    </>
                ) : (
                    <Image
                        source={{ uri: `https://placehold.co/${screenWidth - 40}x200/e1f5fe/0277bd?text=No+Images+Available` }}
                        style={[styles.carouselImagePlaceholder, { width: screenWidth - 40 }]}
                    />
                )}
            </View>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{shop?.name || 'Shop'}</Text>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleOpenEditShopModal}
                    >
                        <Icon name="pencil" size={16} color="#007BFF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.infoItem}>
                    <Icon name="map-marker" size={18} color="#007BFF" style={styles.infoIcon} />
                    <Text style={styles.infoText}>{shop?.address?.fullDetails || 'N/A'}</Text>
                </View>

                <View style={styles.infoItem}>
                    <Icon name="clock-o" size={18} color="#007BFF" style={styles.infoIcon} />
                    <Text style={styles.infoText}>
                        {shop?.openingTime || 'N/A'}-{shop?.closingTime || 'N/A'}
                        {shop?.isManuallyOverridden && (
                            <Text style={styles.overrideText}> (Override)</Text>
                        )}
                    </Text>
                </View>

                <View style={styles.infoItem}>
                    <FontAwesome5 name="star" size={18} color="#FFC107" style={styles.infoIcon} />
                    <Text style={styles.infoText}>
                        {shop?.shopRating?.average?.toFixed(1) ?? '0.0'}
                        ({shop?.shopRating?.count ?? 0} reviews)
                    </Text>
                </View>

                <View style={styles.infoItem}>
                    <Icon name="rocket" size={18} color={shop?.subscription?.status === 'expired' ? '#DC3545' : '#28A745'} style={styles.infoIcon} />
                    <Text style={styles.infoText}>
                        Subscription: <Text style={[styles.subscriptionStatus, { color: shop?.subscription?.status === 'expired' ? '#DC3545' : '#28A745' }]}>{shop?.subscription?.status || 'N/A'}</Text>
                    </Text>
                </View>

                {shop?.subscription?.status === 'trial' && shop?.subscription?.trialEndDate && (
                    <View style={styles.infoItem}>
                        <Icon name="calendar-times-o" size={18} color="#E74C3C" style={styles.infoIcon} />
                        <Text style={styles.infoText}>
                            Trial Ends: {formatDate(shop.subscription.trialEndDate)}
                        </Text>
                    </View>
                )}

                {shop?.subscription?.status === 'active' && shop?.subscription?.lastPlanInfo && (
                    <>
                        <View style={styles.infoItem}>
                            <Icon name="calendar-check-o" size={18} color="#28A745" style={styles.infoIcon} />
                            <Text style={styles.infoText}>
                                Last Payment Date: {formatDate(shop.subscription.lastPlanInfo.startDate)}
                            </Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Icon name="calendar" size={18} color="#007BFF" style={styles.infoIcon} />
                            <Text style={styles.infoText}>
                                Subscription End Date: {formatDate(shop.subscription.lastPlanInfo.endDate)}
                            </Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Icon name="hourglass-half" size={18} color="#F39C12" style={styles.infoIcon} />
                            <Text style={styles.infoText}>
                                Days Remaining: {calculateDaysRemaining(shop.subscription.lastPlanInfo.endDate)}
                            </Text>
                        </View>
                    </>
                )}

                {shop?.subscription?.status === 'expired' && (
                    <TouchableOpacity style={styles.payNowButton} onPress={handlePayNowPress} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payNowButtonText}>Pay Now to Renew</Text>}
                    </TouchableOpacity>
                )}
            </View>

            <Modal visible={isSubscriptionModalVisible} transparent animationType="slide" onRequestClose={() => setIsSubscriptionModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Choose a Plan</Text>
                        {isLoading ? <ActivityIndicator size="large" /> :
                            <FlatList
                                data={subscriptionPlans}
                                keyExtractor={(item) => item._id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={styles.planCard} onPress={() => handleSelectPlan(item)}>
                                        <Text style={styles.planName}>{item.name}</Text>
                                        <Text style={styles.planPrice}>₹{item.price} / {item.duration.value} {item.duration.unit}</Text>
                                        <Text style={styles.planFeatures}>{item.features.join(' • ')}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        }
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsSubscriptionModalVisible(false)}>
                            <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            
            <Modal visible={!!checkoutUrl} animationType="slide" onRequestClose={() => setCheckoutUrl(null)}>
                {checkoutUrl && (
                    <>
                        <WebView
                            source={{ uri: checkoutUrl }}
                            style={{ flex: 1, marginTop: 30 }}
                            onNavigationStateChange={handleWebViewNavigationStateChange}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            startInLoadingState={true}
                            renderLoading={() => <ActivityIndicator size="large" style={{ position: 'absolute', top: '50%', left: '50%' }} />}
                            onError={(syntheticEvent) => {
                                const { nativeEvent } = syntheticEvent;
                                console.error('WebView error: ', nativeEvent);
                                setCheckoutUrl(null); // Close WebView on error
                                Alert.alert("WebView Error", `Failed to load payment page: ${nativeEvent.description || 'Unknown error'}`);
                            }}
                             onHttpError={(syntheticEvent) => {
                                const { nativeEvent } = syntheticEvent;
                                console.error('WebView HTTP error: ', nativeEvent);
                                // This might catch issues like 401/403 if the backend route was protected
                                setCheckoutUrl(null); // Close WebView on HTTP error
                                Alert.alert("WebView HTTP Error", `Failed to load payment page (Status: ${nativeEvent.statusCode}). Please try again.`);
                            }}
                        />
                        <TouchableOpacity style={styles.closeWebViewButton} onPress={() => setCheckoutUrl(null)}>
                            <Text style={styles.closeWebViewButtonText}>Cancel Payment</Text>
                        </TouchableOpacity>
                    </>
                )}
            </Modal>

            <Modal visible={isEditShopModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditShopModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Shop</Text>
                        <ScrollView>
                            <Text style={styles.inputLabel}>Name:</Text>
                            <TextInput style={styles.input} value={editedShopData?.name} onChangeText={txt => setEditedShopData({ ...editedShopData, name: txt })} />
                            <Text style={styles.inputLabel}>Address:</Text>
                            <TextInput style={styles.input} value={editedShopData?.address} onChangeText={txt => setEditedShopData({ ...editedShopData, address: txt })} />
                            <Text style={styles.inputLabel}>Opening (HH:MM):</Text>
                            <TextInput style={styles.input} value={editedShopData?.openingTime} onChangeText={txt => setEditedShopData({ ...editedShopData, openingTime: txt })} />
                            <Text style={styles.inputLabel}>Closing (HH:MM):</Text>
                            <TextInput style={styles.input} value={editedShopData?.closingTime} onChangeText={txt => setEditedShopData({ ...editedShopData, closingTime: txt })} />
                            <View style={styles.toggleRow}>
                                <Text style={styles.toggleLabel}>Status:</Text>
                                <Switch value={editedShopData?.isOpen} onValueChange={handleToggleShopStatusInEditModal} />
                                <Text style={styles.toggleStatusText}>{editedShopData?.isOpen ? 'Open' : 'Closed'}</Text>
                            </View>
                            <Text style={styles.carouselImagesTitle}>Images:</Text>
                            <View style={styles.carouselImagesGrid}>
                                <TouchableOpacity style={styles.addImageButton} onPress={pickShopImage}>
                                    <Icon name="plus" size={30} color="#007BFF" />
                                    <Text>Add</Text>
                                </TouchableOpacity>
                                {editedShopData?.carouselImages.map((img, idx) => (
                                    <View key={idx.toString()} style={styles.carouselEditImageContainer}>
                                        <Image source={{ uri: img }} style={styles.carouselEditImage} />
                                        <TouchableOpacity style={styles.removeImageButton} onPress={() => handleRemoveShopCarouselImage(idx)}>
                                            <Icon name="times-circle" size={24} color="#DC3545" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveShopChanges}>
                                <Text style={styles.modalButtonText}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsEditShopModalVisible(false)}>
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({

    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        padding: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 5,
    },
    carouselContainer: {
        width: '100%',
        height: 200,
        borderRadius: 15,
        overflow: 'hidden',
        backgroundColor: '#F8F9FA',
    },
    carouselImage: {
        height: '100%',
        borderRadius: 15,
    },
    carouselImagePlaceholder: {
        height: 200,
        borderRadius: 15,
        backgroundColor: '#E0F7FA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    paginationDotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 5,
    },
    paginationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#B0BEC5',
        marginHorizontal: 4,
    },
    paginationDotActive: {
        backgroundColor: '#007BFF',
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EFEFEF',
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#333',
    },
    actionButton: {
        padding: 10,
        borderRadius: 25,
        backgroundColor: '#E3F2FD',
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 8,
        paddingVertical: 5,
    },
    infoIcon: {
        marginRight: 15,
        width: 24,
        textAlign: 'center',
    },
    infoText: {
        fontSize: 16,
        color: '#4A4A4A',
        flex: 1,
        lineHeight: 24,
    },
    overrideText: {
        fontStyle: 'italic',
        color: '#DC3545',
        fontSize: 14,
    },
    subscriptionStatus: {
        fontWeight: 'bold',
        textTransform: 'capitalize'
    },
    modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
    },
    modalContent: {
        width: "90%",
        maxHeight: '90%',
        backgroundColor: "#FFFFFF",
        padding: 20,
        borderRadius: 25,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 25,
        elevation: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 20,
        color: "#007BFF",
        textAlign: 'center',
    },
    inputLabel: {
        alignSelf: 'flex-start',
        fontSize: 16,
        color: '#444',
        marginBottom: 6,
        fontWeight: '600',
    },
    input: {
        width: "100%",
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        fontSize: 16,
        backgroundColor: "#F9F9F9",
        color: '#333',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%',
        marginBottom: 20,
        paddingHorizontal: 5,
    },
    toggleLabel: {
        fontSize: 16,
        color: '#444',
        fontWeight: '600',
        marginRight: 15,
    },
    toggleStatusText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
        color: '#333',
    },
    carouselImagesTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#444',
        marginBottom: 15,
        alignSelf: 'flex-start',
    },
    carouselImagesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    carouselEditImageContainer: {
        position: 'relative',
        width: (screenWidth * 0.9 - 60 - 20) / 3,
        height: (screenWidth * 0.9 - 60 - 20) / 3,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#CCC',
        marginBottom: 10,
        marginRight: 10,
    },
    carouselEditImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    removeImageButton: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 15,
        padding: 5,
    },
    addImageButton: {
        width: (screenWidth * 0.9 - 60 - 20) / 3,
        height: (screenWidth * 0.9 - 60 - 20) / 3,
        backgroundColor: '#E3F2FD',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#007BFF',
        borderStyle: 'dashed',
        marginBottom: 10,
        marginRight: 10,
    },
    modalButtonContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
        marginTop: 25,
    },
    modalButton: {
        paddingVertical: 15,
        paddingHorizontal: 15,
        borderRadius: 12,
        alignItems: "center",
        flex: 1,
        marginHorizontal: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 4,
    },
    modalButtonText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "bold",
        textAlign: 'center',
    },
    saveButton: {
        backgroundColor: "#28A745",
    },
    cancelButton: {
        backgroundColor: "#6C757D",
        flex: 0,
        marginTop: 10
    },
    // --- New and Adjusted Styles ---
    payNowButton: {
        backgroundColor: '#DC3545',
        borderRadius: 10,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 15,
        marginHorizontal: 5,
    },
    payNowButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    planCard: {
        backgroundColor: '#F8F9FA',
        borderRadius: 10,
        padding: 20,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    planName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#007BFF',
    },
    planPrice: {
        fontSize: 18,
        color: '#28A745',
        marginVertical: 5,
    },
    planFeatures: {
        fontSize: 14,
        color: '#6C757D',
        marginTop: 5,
    },
    closeWebViewButton: {
      backgroundColor: 'black',
      padding: 15,
      alignItems: 'center',
    },
    closeWebViewButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
});

export default ShopHeader;