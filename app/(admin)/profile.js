import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Animated,
    Alert,
    ActivityIndicator,
    Modal,
    TextInput,
    ImageBackground,
    Linking,
    Dimensions, // Import Dimensions
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";

const API_BASE_URL = "http://10.0.2.2:5000/api"; // Corrected API base URL

// Get screen width for responsive calculations
const { width } = Dimensions.get('window');

export default function TabProfileScreen() {
    const router = useRouter();
    const shineAnimation = useRef(new Animated.Value(0)).current;
    const [barber, setBarber] = useState(null);
    const [history, setHistory] = useState([]); // New state for history
    const [loading, setLoading] = useState(true); // Corrected this line
    const [error, setError] = useState(null);

    const [uid, setUid] = useState(null); // State to store barber's UID
    const [shopId, setShopId] = useState(null);
    const [userToken, setUserToken] = useState(null); // State to store user token

    // New states for editing profile and updating status
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editedProfile, setEditedProfile] = useState({ name: "", phone: "" }); // Removed email, using phone
    const [updating, setUpdating] = useState(false);

    // New state for logout confirmation modal
    const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

    // Fetch necessary data from AsyncStorage on mount
    useEffect(() => {
        const fetchDataFromStorage = async () => {
            const storedUid = await AsyncStorage.getItem("uid");
            const storedShopId = await AsyncStorage.getItem("shopId");
            const storedToken = await AsyncStorage.getItem("userToken");

            if (!storedUid) {
                setError("Barber ID not found in storage");
                setLoading(false);
                return;
            }
            if (!storedShopId) {
                setError("Shop ID not found in storage");
                setLoading(false);
                return;
            }
            if (!storedToken) {
                setError("User token not found in storage. Please log in again.");
                setLoading(false);
                return;
            }
            setUid(storedUid);
            setShopId(storedShopId);
            setUserToken(storedToken);
        };
        fetchDataFromStorage();
    }, []);

    const fetchBarberDetails = async () => {
        if (!uid || !shopId || !userToken) {
            return; // Wait for all necessary data to be loaded from AsyncStorage
        }

        try {
            const response = await fetch(`${API_BASE_URL}/barbers/${uid}`, { // Corrected API path
                headers: {
                    'Authorization': `Bearer ${userToken}` // Pass authentication token
                },
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to fetch barber details");
            }
            const data = await response.json();
            // console.log("Fetched barber details:", data);
            setBarber(data.data);
            setLoading(false); // Only set loading to false after successful fetch
        } catch (error) {
            console.error("Error fetching barber details:", error);
            setError(error.message);
            setLoading(false);
        }
    };

    const fetchBarberHistory = async () => {
        if (!uid || !userToken) return;

        try {
            const response = await fetch(`${API_BASE_URL}/history/barber/${uid}`, {
                headers: {
                    'Authorization': `Bearer ${userToken}`
                },
            });

            if (!response.ok) throw new Error('Failed to fetch history');

            const data = await response.json();


            const validatedHistory = (data.data || []).map(item => ({
                ...item,
                services: (item.services || []).map(s => ({
                    ...s,
                    service: { name: s.name || 'Unknown service' }
                })),
                user: item.user || null,
                customerName: item.customerName || null,
                shop: item.shop || { name: 'N/A' }
            }));

            console.log("Validated history:", JSON.stringify(validatedHistory, null, 2));

            setHistory(validatedHistory);
        } catch (error) {
            console.error("Error fetching barber history:", error);
            setHistory([]);
        }
    };


    // Fetch barber details and history when the screen is focused and all data is available
    useFocusEffect(
        useCallback(() => {
            if (uid && shopId && userToken) {
                fetchBarberDetails();
                fetchBarberHistory();
            }
        }, [uid, shopId, userToken]) // Re-run when these dependencies change
    );

    // Shine animation
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shineAnimation, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(shineAnimation, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [shineAnimation]);

    const shineTranslateX = shineAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [-200, 900],
    });

    const shineTranslateY = shineAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [-200, 250],
    });

    const confirmLogout = async () => {
        try {
            await AsyncStorage.removeItem("userToken");
            await AsyncStorage.removeItem("userType");
            await AsyncStorage.removeItem("uid");
            await AsyncStorage.removeItem("shopId");
            router.replace("../pre-login");
        } catch (error) {
            console.error("Error logging out:", error);
            Alert.alert("Logout Error", "Failed to log out. Please try again.");
        } finally {
            setIsLogoutModalVisible(false); // Close the modal regardless of success or failure
        }
    };

    // Function to update barber profile using the provided backend route
    const updateUserProfile = async () => {
        if (!barber?._id || !userToken) {
            Alert.alert("Error", "Missing barber ID or authentication token.");
            return;
        }

        try {
            setUpdating(true);
            const response = await fetch(`${API_BASE_URL}/barbers/${barber._id}`, { // Use PUT for updating a specific barber by ID
                method: "PUT", // Changed to PUT as per barberRoutes.js update route
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${userToken}` // Pass authentication token
                },
                body: JSON.stringify({
                    name: editedProfile.name,
                    phone: editedProfile.phone, // Changed from email to phone
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error updating barber profile:", errorData);
                Alert.alert("Error", errorData.error || "Failed to update profile");
                return;
            }
            const data = await response.json();
            setBarber(data.data); // Assuming the updated barber data is in 'data' field
            setIsModalVisible(false);
            Alert.alert("Success", "Profile updated successfully");
        } catch (error) {
            console.error("Error updating barber profile:", error);
            Alert.alert("Error", "An error occurred while updating your profile.");
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    return (
        <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
            <View style={styles.overlay} />
            <View style={styles.container}>
                {/* Scrollable content */}
                <ScrollView contentContainerStyle={styles.scrollViewContent}>
                    {/* Profile Box */}
                    <View style={styles.profileBox}>
                        <LinearGradient colors={["#1a1a1a", "#333333", "#1a1a1a"]} style={styles.profileBackground}>
                            {/* Edit Button */}
                            <TouchableOpacity
                                style={styles.editButton}
                                onPress={() => {
                                    setEditedProfile({
                                        name: barber?.name || "",
                                        phone: barber?.phone || "", // Initialize with phone, not email
                                    });
                                    setIsModalVisible(true);
                                }}
                            >
                                <Image
                                    source={require("../image/editw.png")}
                                    style={{ width: 25, height: 25, tintColor: "white" }}
                                />
                            </TouchableOpacity>

                            {/* Logout Button inside Profile Card - Now opens confirmation modal */}
                            <TouchableOpacity style={styles.logoutButton} onPress={() => setIsLogoutModalVisible(true)}>
                                <Icon name="sign-out" size={25} color="white" />
                            </TouchableOpacity>

                            <Animated.View
                                style={[
                                    styles.shine,
                                    {
                                        transform: [
                                            { translateX: shineTranslateX },
                                            { translateY: shineTranslateY },
                                            { rotate: "45deg" },
                                        ],
                                    },
                                ]}
                            >
                                <LinearGradient
                                    colors={["transparent", "rgba(255, 255, 255, 0.3)", "transparent"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.shineGradient}
                                />
                            </Animated.View>
                            <View style={styles.profileContent}>
                                <Image source={require("../image/user.png")} style={styles.profileImage} />
                                <View style={styles.profileDetails}>
                                    <Text style={styles.username}>{barber?.name || "John Doe"}</Text>
                                    <Text style={styles.userInfo}>Phone: {barber?.phone || "+1 234 567 8900"}</Text>
                                    <Text style={styles.userInfo}>Customers Served: {barber?.customersServed || 0}</Text>
                                    <Text style={styles.userInfo}>
                                        Average Rating: {barber?.rating !== undefined ? barber.rating.toFixed(1) : "N/A"}
                                    </Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Service History Section (renamed from Payment History to align with previous user profile) */}
                    <View style={styles.serviceHistoryContainer}>
                        <Text style={styles.sectionTitle}>Service History</Text>
                        <View style={styles.historyBox}>
                            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
                                {(!history || history.length === 0) ? (
                                    <Text style={styles.noHistory}>No service history available.</Text>
                                ) : (
                                    history.map((item, index) => (
                                        <View key={item._id || index} style={styles.historyCard}>
                                            <View style={styles.paymentRow}>
                                                <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString()}</Text>
                                                <Text style={styles.paymentAmount}>₹{item.totalCost?.toFixed(2) || '0.00'}</Text>
                                            </View>
                                            <Text style={styles.historyService}>
                                                {item.services.map(s => s.name || 'Unknown').join(', ')}

                                            </Text>
                                            <Text style={styles.historyService}>Customer: {item.user?.name === 'N/A' ? item.customerName : item.user?.name || item.customerName || 'Guest'}</Text>
                                            <Text style={styles.historyService}>Shop: {item.shop?.name || 'N/A'}</Text>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </View>

                    {/* Company / Info Section */}
                    <View style={styles.companyContainer}>
                        <LinearGradient colors={["#1a1a1a", "#2c2c2c", "#1a1a1a"]} style={styles.companyBackground}>
                            <Text style={styles.companyTitle}>Bludgers Technologies</Text>
                            <Text style={styles.companyTagline}>Innovating Daily Living</Text>
                            <Text style={styles.companyDescription}>
                                Bludgers Technologies is dedicated to crafting seamless and intuitive mobile applications,
                                ensuring the best user experience with cutting-edge solutions.
                            </Text>
                            <View style={styles.divider} />
                            {/* Mail and Phone are now left-aligned */}
                            <TouchableOpacity style={styles.contactItem} onPress={() => Linking.openURL("mailto:bludgers52@gmail.com")}>
                                <Text style={styles.companyWebsite}>📧 Mail: bludgers52@gmail.com</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.contactItem} onPress={() => Linking.openURL("tel:8601346652")}>
                                <View style={styles.phoneContainer}>
                                    <Icon name="phone" size={18} color="#00aaff" />
                                    <Text style={styles.numberText}>Phone: 8601346652</Text>
                                </View>
                            </TouchableOpacity>
                            <View style={styles.divider} />
                            {/* New information links arranged in a 2x2 grid, left-aligned */}
                            <View style={styles.infoGrid}>
                                <TouchableOpacity style={styles.infoGridItem} onPress={() => Linking.openURL("https://www.example.com/terms")}>
                                    <Text style={styles.infoLinkText}>Terms and Conditions</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.infoGridItem} onPress={() => Linking.openURL("https://www.example.com/privacy")}>
                                    <Text style={styles.infoLinkText}>Privacy Policy</Text>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </View>
                </ScrollView>
            </View>

            {/* Modal for editing profile */}
            <Modal visible={isModalVisible} transparent animationType="slide">
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Profile</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Name"
                            value={editedProfile.name}
                            onChangeText={(text) => setEditedProfile({ ...editedProfile, name: text })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Phone"
                            value={editedProfile.phone}
                            onChangeText={(text) => setEditedProfile({ ...editedProfile, phone: text })}
                            keyboardType="phone-pad"
                        />
                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity style={styles.modalButton} onPress={() => setIsModalVisible(false)}>
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalButton} onPress={updateUserProfile} disabled={updating}>
                                {updating ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.modalButtonText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal for Logout Confirmation */}
            <Modal visible={isLogoutModalVisible} transparent animationType="fade">
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Confirm Logout</Text>
                        <Text style={styles.modalMessage}>Are you sure you want to log out?</Text>
                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#FF6347' }]} onPress={() => setIsLogoutModalVisible(false)}>
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#1a1a1a' }]} onPress={confirmLogout}>
                                <Text style={styles.modalButtonText}>Logout</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    backgroundImage: {
        flex: 1,
        resizeMode: "cover",
        position: "absolute",
        width: "100%",
        height: "100%",
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(237, 236, 236, 0.77)",
    },
    container: {
        flex: 1,
        width: "100%",
    },
    scrollViewContent: {
        padding: 20,
        paddingBottom: 20,
        alignItems: "center",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
    },
    errorText: {
        fontSize: 16,
        color: "red"
    },
    // --- Profile Card Styling ---
    profileBox: {
        width: '95%', // Responsive width
        height: width * 0.45, // Height responsive to width
        borderRadius: 15,
        overflow: "hidden",
        marginBottom: 20,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    profileBackground: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    shine: {
        position: "absolute",
        top: 0,
        left: 0,
        width: 300,
        height: "300%"
    },
    shineGradient: {
        width: "100%",
        height: "100%"
    },
    profileContent: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        paddingHorizontal: 0,
    },
    profileImage: {
        width: width * 0.22, // Responsive image size
        height: width * 0.22, // Responsive image size
        borderRadius: (width * 0.22) / 2, // Perfect circle
        borderWidth: 3,
        borderColor: "#eee",
        marginRight: 20,
    },
    profileDetails: {
        flex: 1,
    },
    username: {
        fontSize: width * 0.06, // Responsive font size
        fontWeight: "bold",
        color: "#fff",
        marginBottom: 5,
    },
    userInfo: {
        fontSize: width * 0.04, // Responsive font size
        fontWeight: "400",
        color: "#f0f0f0",
        marginTop: 2,
    },
    // --- End Profile Card Styling ---

    sectionTitle: {
        fontSize: width * 0.055, // Responsive font size
        fontWeight: "bold",
        marginBottom: 15,
        color: "#333",
        alignSelf: 'flex-start',
        marginLeft: 10,
    },
    serviceHistoryContainer: {
        width: "100%",
        alignItems: "center",
        marginBottom: 20,
    },
    historyBox: {
        backgroundColor: "#fff",
        borderRadius: 15,
        width: "95%", // Responsive width
        padding: 15,
        maxHeight: 300,
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
    },
    historyCard: {
        backgroundColor: "#F0F0F0",
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    paymentRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 5,
    },
    historyDate: {
        fontSize: width * 0.038, // Responsive font size
        color: "#666",
        fontWeight: '500',
    },
    paymentAmount: {
        fontSize: width * 0.045, // Responsive font size
        fontWeight: "bold",
        color: "rgb(16, 120, 50)",
    },
    historyService: {
        fontSize: width * 0.04, // Responsive font size
        color: "#555",
        marginTop: 3,
        lineHeight: 20,
    },
    noHistory: {
        fontSize: width * 0.042, // Responsive font size
        color: "#999",
        textAlign: "center",
        marginTop: 20,
        fontStyle: 'italic',
    },
    editButton: {
        position: "absolute",
        top: 15,
        right: 60, // Increased right value for more gap
        padding: 8,
        borderRadius: 15,
        alignItems: "center",
        zIndex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    // --- Logout Button Styling ---
    logoutButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        padding: 8,
        borderRadius: 15,
        alignItems: 'center',
        zIndex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    // --- End Logout Button Styling ---

    modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
    },
    modalContent: {
        width: "88%",
        backgroundColor: "#fff",
        padding: 25,
        borderRadius: 15,
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
    },
    modalTitle: {
        fontSize: width * 0.055, // Responsive font size
        fontWeight: "bold",
        marginBottom: 20,
        textAlign: "center",
        color: '#333',
    },
    modalMessage: { // New style for modal message
        fontSize: width * 0.045,
        textAlign: 'center',
        marginBottom: 20,
        color: '#555',
    },
    input: {
        width: "100%",
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
        marginBottom: 15,
        fontSize: width * 0.04, // Responsive font size
        color: '#333',
        backgroundColor: '#f9f9f9',
    },
    modalButtonContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginTop: 15,
    },
    modalButton: {
        flex: 1,
        backgroundColor: "#1a1a1a",
        padding: 12,
        borderRadius: 8,
        alignItems: "center",
        marginHorizontal: 8,
    },
    modalButtonText: {
        color: "#fff",
        fontSize: width * 0.045, // Responsive font size
        fontWeight: "bold",
    },
    companyContainer: {
        width: "95%", // Responsive width
        borderRadius: 15,
        overflow: "hidden",
        marginBottom: 20,
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
    },
    companyBackground: {
        padding: 20,
        borderRadius: 15,
    },
    companyTitle: {
        fontSize: width * 0.065, // Responsive font size
        fontWeight: "bold",
        color: "#fff",
        marginBottom: 10,
        textAlign: "center",
    },
    companyTagline: {
        fontSize: width * 0.045, // Responsive font size
        color: "#ddd",
        marginBottom: 15,
        fontStyle: "italic",
        textAlign: "center",
    },
    companyDescription: {
        fontSize: width * 0.04, // Responsive font size
        color: "#ccc",
        textAlign: "justify", // Kept this as justify for a block of text
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    companyWebsite: {
        fontSize: width * 0.04, // Responsive font size
        color: "#00c0ff",
        fontWeight: "bold",
        // textAlign: 'left', // This is the key change
    },
    divider: {
        height: 1,
        backgroundColor: "#555",
        width: "80%",
        marginVertical: 18,
        alignSelf: 'center',
    },
    contactItem: { // New style for individual contact lines
        alignSelf: 'flex-start', // Align the TouchableOpacity to the left
        marginBottom: 5, // Add a small gap between contact items
    },
    phoneContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start", // Changed to flex-start
    },
    numberText: {
        fontSize: width * 0.04, // Responsive font size
        fontWeight: "bold",
        color: "#00c0ff",
        marginLeft: 8,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around', // Keep this for the grid layout
        marginTop: 15,
        paddingHorizontal: 10,
    },
    infoGridItem: {
        width: '45%',
        paddingVertical: 8,
        marginBottom: 10,
        alignItems: 'flex-start', // Align grid items to the left
    },
    infoLinkText: {
        fontSize: width * 0.035, // Responsive font size
        color: "#ADD8E6",
        textDecorationLine: "underline",
        textAlign: "left", // Ensure text within grid item is left-aligned
    },
});