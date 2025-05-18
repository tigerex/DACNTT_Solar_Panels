import express from 'express';
import { getUsers } from './ModuleControllers.js';

const router = express.Router();

router.get('/', getUsers);

export default router;
