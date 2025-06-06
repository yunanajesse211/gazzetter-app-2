<?php
header('Content-Type: application/json');
$lat = $_GET['lat'] ?? '';
$lng = $_GET['lng'] ?? '';
if (!$lat || !$lng) {
  echo json_encode(['error' => 'Missing coordinates']);
  exit;
}
$apiKey = '9e8037ce17207e454a9c5cdb3a86b87e';
$url = "https://api.openweathermap.org/data/2.5/weather?lat=$lat&lon=$lng&units=metric&appid=$apiKey";
$response = file_get_contents($url);
if ($response === false) {
  echo json_encode(['error' => 'Weather fetch failed']);
  exit;
}
echo $response;