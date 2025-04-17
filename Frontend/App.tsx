import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Modal,
  FlatList,
  TouchableWithoutFeedback,
  TextInput,
  Alert,
  BackHandler,
} from 'react-native';
import Slider from '@react-native-community/slider';
import axios from 'axios';
import Icon from 'react-native-vector-icons/Ionicons';

export default function App() {
  const [players, setPlayers] = useState([]);
  const [selectedHost, setSelectedHost] = useState('');
  const [nowPlaying, setNowPlaying] = useState({ title: '', artist: '', albumArt: '' });
  const [volume, setVolume] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [backendUrl, setBackendUrl] = useState('http://10.0.2.2:3000');

  useEffect(() => {
    const loadConfig = async () => {
      const savedUrl = await AsyncStorage.getItem('backendUrl');
      if (savedUrl) setBackendUrl(savedUrl);
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (!backendUrl) return;
    loadSpeakers();
  }, [backendUrl]);

  useEffect(() => {
    if (!selectedHost || !backendUrl) return;

    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${backendUrl}/status?host=${selectedHost}`);
        setNowPlaying(res.data);
        setIsPlaying(res.data.transportState === 'PLAYING');

        const volRes = await axios.get(`${backendUrl}/volume?host=${selectedHost}`);
        if (typeof volRes.data.volume === 'number') {
          setVolume(volRes.data.volume);
        }
      } catch (err) {
        console.error('Status error:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [selectedHost, backendUrl]);

  const loadSpeakers = async () => {
    try {
      const res = await axios.get(`${backendUrl}/players`);
      setPlayers(res.data);

      const savedHost = await AsyncStorage.getItem('selectedSpeaker');
      if (savedHost && res.data.find(p => p.host === savedHost)) {
        setSelectedHost(savedHost);
      } else if (res.data.length > 0) {
        setSelectedHost(res.data[0].host);
      }
    } catch (err) {
      console.error('Failed to load players:', err);
    }
  };

  const sendControl = async (action) => {
    if (!selectedHost || !backendUrl) return;
    try {
      await axios.post(`${backendUrl}/control`, { host: selectedHost, action });
      setIsPlaying(action === 'play');
    } catch (err) {
      console.error(`Failed to ${action}`, err);
    }
  };

  const sendVolume = async (val) => {
    if (!selectedHost || !backendUrl) return;
    const rounded = Math.round(val);
    setVolume(rounded);
    try {
      await axios.post(`${backendUrl}/volume`, { host: selectedHost, volume: rounded });
    } catch (err) {
      console.error('Failed to set volume', err);
    }
  };

  const handleTripleTap = () => {
    setTapCount(prev => {
      const next = prev + 1;
      if (next >= 3) {
        setTapCount(0);
        setSettingsVisible(true);
      }
      setTimeout(() => setTapCount(0), 1000);
      return next;
    });
  };

  const saveBackendUrl = async () => {
    try {
      await AsyncStorage.setItem('backendUrl', backendUrl);
      Alert.alert('Saved', 'Backend URL updated.');
      setSettingsVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save backend URL');
    }
  };

  const refreshApp = async () => {
    try {
      setPlayers([]);
      setSelectedHost('');
      setNowPlaying({ title: '', artist: '', albumArt: '' });
      setVolume(30);
      setIsPlaying(false);
      await loadSpeakers();
      setSettingsVisible(false);
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  };

  return (
    <ImageBackground
      source={{ uri: nowPlaying.albumArt || 'https://via.placeholder.com/300' }}
      style={styles.background}
      blurRadius={40}
    >
      <View style={styles.overlay} />

      <View style={styles.container}>
        <TouchableOpacity style={styles.speakerPill} onPress={() => setModalVisible(true)}>
          <Icon name="radio-outline" size={20} color="#fff" />
        </TouchableOpacity>

        <Modal transparent animationType="slide" visible={isModalVisible} onRequestClose={() => setModalVisible(false)}>
          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Choose Speaker</Text>
                <FlatList
                  data={players}
                  keyExtractor={(item) => item.host}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.modalItem}
                      onPress={async () => {
                        await AsyncStorage.setItem('selectedSpeaker', item.host);
                        setSelectedHost(item.host);
                        setModalVisible(false);
                        try {
                          const res = await axios.get(`${backendUrl}/volume?host=${item.host}`);
                          if (typeof res.data.volume === 'number') setVolume(res.data.volume);
                        } catch (err) {
                          console.error('Failed to fetch volume:', err);
                        }
                      }}
                    >
                      <Icon name="radio-outline" size={20} color="#333" style={{ marginRight: 10 }} />
                      <Text style={styles.modalItemText}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <View onTouchEnd={handleTripleTap} style={styles.albumWrapper}>
          {nowPlaying.albumArt ? (
            <Image source={{ uri: nowPlaying.albumArt }} style={styles.albumArtLarge} />
          ) : (
            <View style={styles.albumFallbackLarge}>
              <Icon name="musical-notes-outline" size={72} color="#777" />
            </View>
          )}

          <View style={styles.controlsOverlay}>
            <TouchableOpacity onPress={() => sendControl('previous')}>
              <Icon name="play-skip-back" size={36} color="white" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => sendControl(isPlaying ? 'pause' : 'play')}>
              <Icon name={isPlaying ? 'pause-circle' : 'play-circle'} size={52} color="white" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => sendControl('next')}>
              <Icon name="play-skip-forward" size={36} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.metaBlock}>
          <Text style={styles.track}>{nowPlaying.title || 'Unknown'}</Text>
          <Text style={styles.artist}>{nowPlaying.artist}</Text>
        </View>

        <View style={styles.volumeRow}>
          <Icon name="volume-low" size={20} color="white" />
          <View style={styles.sliderWrapper}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={volume}
              onValueChange={sendVolume}
              minimumTrackTintColor="#fff"
              maximumTrackTintColor="#555"
              thumbTintColor="#fff"
            />
          </View>
          <Text style={styles.volumeText}>{volume}</Text>
        </View>

        <Modal visible={settingsVisible} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Settings</Text>
              <Text style={{ marginBottom: 10 }}>Backend URL</Text>
              <TextInput
                value={backendUrl}
                onChangeText={setBackendUrl}
                style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 20 }}
                placeholder="http://10.0.2.2:3000"
              />
              <TouchableOpacity onPress={saveBackendUrl} style={{ backgroundColor: '#333', padding: 12, borderRadius: 6, marginBottom: 10 }}>
                <Text style={{ color: 'white', textAlign: 'center' }}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={refreshApp} style={{ backgroundColor: '#666', padding: 12, borderRadius: 6, marginBottom: 10 }}>
                <Text style={{ color: 'white', textAlign: 'center' }}>Restart App</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => BackHandler.exitApp()} style={{ backgroundColor: '#900', padding: 12, borderRadius: 6 }}>
                <Text style={{ color: 'white', textAlign: 'center' }}>Exit App</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, resizeMode: 'cover', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 80, // ⬅️ Add large space at bottom
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  speakerPill: {
    position: 'absolute',
    top: 30,
    left: 20,
    width: 36,
    height: 36,
    backgroundColor: '#4447',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  albumWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 0,
    marginBottom: 10,
    alignSelf: 'center',
  },
  albumArtLarge: {
    width: 300,
    height: 300,
    borderRadius: 20,
  },
  albumFallbackLarge: {
    width: 300,
    height: 300,
    borderRadius: 20,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  metaBlock: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 0,
  },
  track: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  artist: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 4,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 0,
  },
  sliderWrapper: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  volumeText: { color: '#fff', width: 30, textAlign: 'right' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 10, padding: 20, width: '80%', maxHeight: '60%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomColor: '#eee', borderBottomWidth: 1 },
  modalItemText: { fontSize: 16, color: '#333' },
});
