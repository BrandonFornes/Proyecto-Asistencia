import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Image, Alert,
  ActivityIndicator, StyleSheet, SafeAreaView, StatusBar,
  Animated, Platform, Modal, TextInput, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

// ── CONFIGURA LA IP DE TU COMPUTADORA AQUÍ ─────────────────────────────────
const API_URL = 'http://192.168.0.103:8000'; // ← Cambia esto
// ────────────────────────────────────────────────────────────────────────────

const COLORS = {
  bg:         '#0D1B2A',
  surface:    '#1A2D42',
  card:       '#1E3550',
  accent:     '#4A9EFF',
  accentDark: '#2563EB',
  success:    '#22C55E',
  warning:    '#F59E0B',
  error:      '#EF4444',
  text:       '#E8F0FE',
  textMuted:  '#8BA3BF',
  border:     '#2A4060',
};

// ── Componente Principal ───────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('attendance'); // 'attendance' | 'register' | 'list'
  const [group, setGroup] = useState('General');
  const [groups, setGroups] = useState(['General']);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_URL}/groups`);
      const data = await res.json();
      if (data.length > 0) setGroups(data);
    } catch {}
  };

  const switchTab = (newTab) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTab(newTab);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📋 AsistenciaFace</Text>
          <Text style={styles.headerSub}>Grupo: {group}</Text>
        </View>
        <GroupPicker group={group} groups={groups} onSelect={(g) => { setGroup(g); fetchGroups(); }} />
      </View>

      {/* Content */}
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
        {tab === 'attendance' && <AttendanceTab group={group} />}
        {tab === 'register'   && <RegisterTab  group={group} onRegistered={fetchGroups} />}
        {tab === 'list'       && <StudentListTab group={group} />}
      </Animated.View>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        {[
          { key: 'attendance', icon: 'camera',       label: 'Asistencia' },
          { key: 'register',   icon: 'person-add',   label: 'Registrar'  },
          { key: 'list',       icon: 'people',       label: 'Alumnos'    },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.navItem, tab === item.key && styles.navItemActive]}
            onPress={() => switchTab(item.key)}
          >
            <Ionicons
              name={item.icon}
              size={24}
              color={tab === item.key ? COLORS.accent : COLORS.textMuted}
            />
            <Text style={[styles.navLabel, tab === item.key && styles.navLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

// ── Group Picker ───────────────────────────────────────────────────────────
function GroupPicker({ group, groups, onSelect }) {
  const [visible, setVisible] = useState(false);
  const [newGroup, setNewGroup] = useState('');

  return (
    <>
      <TouchableOpacity style={styles.groupBadge} onPress={() => setVisible(true)}>
        <Text style={styles.groupBadgeText}>{group}</Text>
        <Ionicons name="chevron-down" size={14} color={COLORS.accent} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setVisible(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Seleccionar Grupo</Text>
            {groups.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.groupOption, g === group && styles.groupOptionActive]}
                onPress={() => { onSelect(g); setVisible(false); }}
              >
                <Text style={styles.groupOptionText}>{g}</Text>
                {g === group && <Ionicons name="checkmark" size={18} color={COLORS.accent} />}
              </TouchableOpacity>
            ))}
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Nuevo grupo..."
                placeholderTextColor={COLORS.textMuted}
                value={newGroup}
                onChangeText={setNewGroup}
              />
              <TouchableOpacity
                style={[styles.btnSmall, { marginLeft: 8 }]}
                onPress={() => {
                  if (newGroup.trim()) {
                    onSelect(newGroup.trim());
                    setVisible(false);
                    setNewGroup('');
                  }
                }}
              >
                <Text style={styles.btnSmallText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ── Tab: Asistencia ────────────────────────────────────────────────────────
function AttendanceTab({ group }) {
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [todayList, setTodayList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  useEffect(() => { fetchTodayList(); }, [group]);

  const fetchTodayList = async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${API_URL}/attendance/today?group=${encodeURIComponent(group)}`);
      const data = await res.json();
      setTodayList(data.students || []);
    } catch {
      setTodayList([]);
    } finally {
      setLoadingList(false);
    }
  };

  const pickPhoto = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Se necesita acceso para continuar.');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });

    if (!result.canceled) {
      setPhoto(result.assets[0]);
      setResult(null);
    }
  };

  const processAttendance = async () => {
    if (!photo) return;
    setLoading(true);
    startPulse();

    try {
      const form = new FormData();
      form.append('photo', {
        uri: photo.uri,
        name: 'attendance.jpg',
        type: 'image/jpeg',
      });
      form.append('group', group);

      const res = await fetch(`${API_URL}/attendance/recognize`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error en el servidor');
      }

      const data = await res.json();
      setResult(data);
      fetchTodayList();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  };

  const downloadExcel = async () => {
    try {
      const url = `${API_URL}/attendance/download?group=${encodeURIComponent(group)}`;
      const dest = FileSystem.documentDirectory + `Asistencia_${group}_hoy.xlsx`;
      const { uri } = await FileSystem.downloadAsync(url, dest);
      await Sharing.shareAsync(uri);
    } catch {
      Alert.alert('Error', 'No se pudo descargar el archivo.');
    }
  };

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Foto Preview */}
      <View style={styles.photoContainer}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} resizeMode="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.photoPlaceholderText}>Toma o selecciona una foto del grupo</Text>
          </View>
        )}
      </View>

      {/* Botones de foto */}
      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1, marginRight: 8 }]} onPress={() => pickPhoto(true)}>
          <Ionicons name="camera" size={20} color={COLORS.accent} />
          <Text style={[styles.btnText, { color: COLORS.accent }]}>Cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={() => pickPhoto(false)}>
          <Ionicons name="image" size={20} color={COLORS.accent} />
          <Text style={[styles.btnText, { color: COLORS.accent }]}>Galería</Text>
        </TouchableOpacity>
      </View>

      {/* Procesar */}
      {photo && (
        <Animated.View style={{ transform: [{ scale: loading ? pulseAnim : 1 }] }}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={processAttendance}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="scan" size={20} color="#fff" />
            )}
            <Text style={styles.btnTextWhite}>
              {loading ? 'Reconociendo caras...' : 'Pasar Asistencia'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Resultado */}
      {result && (
        <ResultCard result={result} />
      )}

      {/* Lista del día */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>✅ Presentes Hoy ({todayList.length})</Text>
        <View style={styles.row}>
          <TouchableOpacity onPress={fetchTodayList} style={{ marginRight: 12 }}>
            <Ionicons name="refresh" size={20} color={COLORS.accent} />
          </TouchableOpacity>
          {todayList.length > 0 && (
            <TouchableOpacity onPress={downloadExcel}>
              <Ionicons name="download" size={20} color={COLORS.success} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loadingList ? (
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 16 }} />
      ) : todayList.length === 0 ? (
        <Text style={styles.emptyText}>Aún no hay asistencia registrada hoy.</Text>
      ) : (
        todayList.map((s, i) => (
          <View key={s.id} style={styles.attendanceRow}>
            <View style={styles.attendanceNum}>
              <Text style={styles.attendanceNumText}>{s.num}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.attendanceName}>{s.name}</Text>
              <Text style={styles.attendanceMeta}>{s.id} · {s.group}</Text>
            </View>
            <View style={styles.timeBadge}>
              <Text style={styles.timeBadgeText}>{s.time}</Text>
            </View>
          </View>
        ))
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ── Result Card ────────────────────────────────────────────────────────────
function ResultCard({ result }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80 }).start();
  }, []);

  return (
    <Animated.View style={[styles.resultCard, { transform: [{ scale: scaleAnim }] }]}>
      <Text style={styles.resultTitle}>Resultado del Reconocimiento</Text>
      <View style={styles.resultStats}>
        <Stat label="Caras detectadas" value={result.total_faces} color={COLORS.accent}    />
        <Stat label="Reconocidos"       value={result.recognized.length} color={COLORS.success} />
        <Stat label="Desconocidos"      value={result.unknown}  color={COLORS.warning} />
      </View>
      {result.recognized.map((s) => (
        <View key={s.id} style={styles.recognizedItem}>
          <Ionicons
            name={s.already_registered ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={22}
            color={s.already_registered ? COLORS.warning : COLORS.success}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.recognizedName}>{s.name}</Text>
            <Text style={styles.recognizedMeta}>
              {s.already_registered ? 'Ya registrado' : `Registrado a las ${s.time}`}
              {' · '}Confianza: {s.confidence}%
            </Text>
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

function Stat({ label, value, color }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Tab: Registrar Alumno ──────────────────────────────────────────────────
function RegisterTab({ group, onRegistered }) {
  const [name, setName]   = useState('');
  const [id, setId]       = useState('');
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickPhoto = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) return;

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.9, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.9, allowsEditing: true, aspect: [1, 1] });

    if (!result.canceled) setPhoto(result.assets[0]);
  };

  const register = async () => {
    if (!name.trim() || !id.trim() || !photo) {
      Alert.alert('Campos incompletos', 'Completa el nombre, ID y foto del alumno.');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('student_id', id.trim());
      form.append('group', group);
      form.append('photo', {
        uri: photo.uri,
        name: 'student.jpg',
        type: 'image/jpeg',
      });

      const res = await fetch(`${API_URL}/students/register`, {
        method: 'POST',
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al registrar');

      Alert.alert('✅ Registrado', data.message);
      setName(''); setId(''); setPhoto(null);
      onRegistered();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Registrar Alumno</Text>
      <Text style={styles.pageSubtitle}>Grupo: {group}</Text>

      {/* Foto */}
      <TouchableOpacity onPress={() => pickPhoto(true)} style={styles.avatarContainer}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person-add" size={48} color={COLORS.textMuted} />
            <Text style={styles.avatarPlaceholderText}>Toca para agregar foto</Text>
          </View>
        )}
        <View style={styles.avatarBadge}>
          <Ionicons name="camera" size={16} color="#fff" />
        </View>
      </TouchableOpacity>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1, marginRight: 8 }]} onPress={() => pickPhoto(true)}>
          <Ionicons name="camera" size={18} color={COLORS.accent} />
          <Text style={[styles.btnText, { color: COLORS.accent, fontSize: 13 }]}>Cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={() => pickPhoto(false)}>
          <Ionicons name="images" size={18} color={COLORS.accent} />
          <Text style={[styles.btnText, { color: COLORS.accent, fontSize: 13 }]}>Galería</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.inputLabel}>Nombre completo</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ej: Juan García López"
        placeholderTextColor={COLORS.textMuted}
      />

      <Text style={styles.inputLabel}>ID / Matrícula</Text>
      <TextInput
        style={styles.input}
        value={id}
        onChangeText={setId}
        placeholder="Ej: A12345"
        placeholderTextColor={COLORS.textMuted}
        autoCapitalize="characters"
      />

      <TouchableOpacity
        style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled, { marginTop: 8 }]}
        onPress={register}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="save" size={20} color="#fff" />}
        <Text style={styles.btnTextWhite}>{loading ? 'Registrando...' : 'Registrar Alumno'}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Tab: Lista de Alumnos ──────────────────────────────────────────────────
function StudentListTab({ group }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');

  useEffect(() => { fetchStudents(); }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/students`);
      const data = await res.json();
      setStudents(data);
    } catch {
      Alert.alert('Error', 'No se pudo conectar al servidor.');
    } finally {
      setLoading(false);
    }
  };

  const deleteStudent = (student) => {
    Alert.alert(
      'Eliminar alumno',
      `¿Seguro que quieres eliminar a ${student.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_URL}/students/${student.id}`, { method: 'DELETE' });
              fetchStudents();
            } catch {
              Alert.alert('Error', 'No se pudo eliminar.');
            }
          },
        },
      ]
    );
  };

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.tabContent}>
      <Text style={styles.pageTitle}>Alumnos Registrados</Text>
      <Text style={styles.pageSubtitle}>{students.length} alumnos en total</Text>

      <TextInput
        style={[styles.input, { marginBottom: 8 }]}
        placeholder="Buscar por nombre o ID..."
        placeholderTextColor={COLORS.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 32 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>
            {search ? 'Sin resultados.' : 'No hay alumnos registrados.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          onRefresh={fetchStudents}
          refreshing={loading}
          renderItem={({ item }) => (
            <View style={styles.studentRow}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentAvatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{item.name}</Text>
                <Text style={styles.studentMeta}>{item.id} · {item.group || 'General'}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteStudent(item)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.bg },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                   padding: 16, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle:   { fontSize: 20, fontWeight: '800', color: COLORS.text },
  headerSub:     { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  groupBadge:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                    borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  groupBadgeText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },

  tabContent:    { flex: 1, padding: 16 },
  pageTitle:     { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  pageSubtitle:  { fontSize: 13, color: COLORS.textMuted, marginBottom: 20 },

  // Bottom nav
  bottomNav:     { flexDirection: 'row', backgroundColor: COLORS.surface,
                   borderTopWidth: 1, borderTopColor: COLORS.border, paddingBottom: 8 },
  navItem:       { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  navItemActive: { borderTopWidth: 2, borderTopColor: COLORS.accent },
  navLabel:      { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  navLabelActive:{ color: COLORS.accent, fontWeight: '700' },

  // Photo
  photoContainer:     { borderRadius: 16, overflow: 'hidden', marginBottom: 12,
                        backgroundColor: COLORS.card, height: 220 },
  photoPreview:       { width: '100%', height: '100%' },
  photoPlaceholder:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoPlaceholderText: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },

  // Buttons
  row:           { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  btn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                   paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, gap: 8, marginBottom: 12 },
  btnPrimary:    { backgroundColor: COLORS.accentDark },
  btnOutline:    { borderWidth: 1.5, borderColor: COLORS.accent },
  btnDisabled:   { opacity: 0.6 },
  btnText:       { fontSize: 14, fontWeight: '600' },
  btnTextWhite:  { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnSmall:      { backgroundColor: COLORS.accentDark, paddingHorizontal: 14,
                   paddingVertical: 10, borderRadius: 10 },
  btnSmallText:  { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Input
  inputLabel:   { color: COLORS.textMuted, fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input:        { backgroundColor: COLORS.card, color: COLORS.text, borderRadius: 12,
                  padding: 14, fontSize: 15, marginBottom: 16,
                  borderWidth: 1, borderColor: COLORS.border },

  // Result
  resultCard:      { backgroundColor: COLORS.card, borderRadius: 16, padding: 16,
                     marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  resultTitle:     { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  resultStats:     { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  statBox:         { alignItems: 'center' },
  statValue:       { fontSize: 28, fontWeight: '800' },
  statLabel:       { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: 2 },
  recognizedItem:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
                     borderTopWidth: 1, borderTopColor: COLORS.border },
  recognizedName:  { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  recognizedMeta:  { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  // Attendance list
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    marginTop: 8, marginBottom: 12 },
  sectionTitle:   { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  attendanceRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
                    borderRadius: 12, padding: 12, marginBottom: 8,
                    borderWidth: 1, borderColor: COLORS.border },
  attendanceNum:  { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surface,
                    alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  attendanceNumText: { color: COLORS.accent, fontWeight: '700', fontSize: 14 },
  attendanceName: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  attendanceMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  timeBadge:      { backgroundColor: COLORS.bg, paddingHorizontal: 8, paddingVertical: 4,
                    borderRadius: 8, borderWidth: 1, borderColor: COLORS.success },
  timeBadgeText:  { color: COLORS.success, fontSize: 11, fontWeight: '700' },

  // Avatar / register
  avatarContainer:   { alignSelf: 'center', marginBottom: 16, position: 'relative' },
  avatar:            { width: 120, height: 120, borderRadius: 60,
                       borderWidth: 3, borderColor: COLORS.accent },
  avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.card,
                       alignItems: 'center', justifyContent: 'center',
                       borderWidth: 2, borderColor: COLORS.border, gap: 4 },
  avatarPlaceholderText: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center' },
  avatarBadge:   { position: 'absolute', bottom: 2, right: 2, backgroundColor: COLORS.accentDark,
                   width: 28, height: 28, borderRadius: 14,
                   alignItems: 'center', justifyContent: 'center' },

  // Student list
  studentRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
                   borderRadius: 12, padding: 12, marginBottom: 8,
                   borderWidth: 1, borderColor: COLORS.border },
  studentAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.accentDark,
                   alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  studentAvatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  studentName:   { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  studentMeta:   { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  deleteBtn:     { padding: 8 },

  emptyState:    { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText:     { color: COLORS.textMuted, textAlign: 'center', fontSize: 14, marginTop: 8 },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center',
                   alignItems: 'center', padding: 24 },
  modalCard:     { backgroundColor: COLORS.surface, borderRadius: 20, padding: 20,
                   width: '100%', borderWidth: 1, borderColor: COLORS.border },
  modalTitle:    { color: COLORS.text, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  groupOption:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                   paddingVertical: 12, paddingHorizontal: 4,
                   borderBottomWidth: 1, borderBottomColor: COLORS.border },
  groupOptionActive: { backgroundColor: `${COLORS.accent}15`, borderRadius: 8,
                       paddingHorizontal: 8 },
  groupOptionText:   { color: COLORS.text, fontSize: 15 },
});
