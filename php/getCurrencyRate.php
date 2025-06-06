<?php
header('Content-Type: application/json');
$currency = $_GET['currency'] ?? '';
if (!$currency) {
  echo json_encode(['error' => 'Missing currency code']);
  exit;
}
$apiKey = 'd95e553aa8104f1099e34806b665c61f';
$url = "https://openexchangerates.org/api/latest.json?app_id=$apiKey";
$response = file_get_contents($url);
if ($response === false) {
  echo json_encode(['error' => 'Currency fetch failed']);
  exit;
}
$data = json_decode($response, true);
$rate = $data['rates'][$currency] ?? null;
if (!$rate) {
  echo json_encode(['error' => 'Rate not found']);
} else {
  echo json_encode(['rate' => $rate]);
}
