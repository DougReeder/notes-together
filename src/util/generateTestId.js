// generateTestId.js - generate an ID in a limited range, which can be deleted
// Copyright © 2021 Doug Reeder

import {v4 as uuidv4} from "uuid";

export default function generateTestId() {
  const random = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, Math.floor(Math.random()*256), Math.floor(Math.random()*256), Math.floor(Math.random()*256)];
  return uuidv4({random});
}
