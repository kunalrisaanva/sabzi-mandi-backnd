import { ColdStorage } from "../models/coldStorage.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Create Cold Storage
const createColdStorage = asyncHandler(async (req, res) => {
    const {
        name,
        address,
        city,
        state,
        pincode,
        phone,
        email,
        capacity,
        pricePerTon
    } = req.body;

    // Validation
    if (!name || !address || !city || !state || !pincode || !phone || !email || !capacity || !pricePerTon) {
        throw new ApiError(400, "All fields are required");
    }

    // Create cold storage
    const coldStorage = await ColdStorage.create({
        owner: req.user._id, // From auth middleware
        name,
        address,
        city,
        state,
        pincode,
        phone,
        email,
        capacity,
        availableCapacity: capacity, // Initially same as capacity
        pricePerTon
    });

    return res.json(
        new ApiResponse(201, { coldStorage }, "Cold storage created successfully")
    );
});

// Get All Cold Storages (with filters)
const getAllColdStorages = asyncHandler(async (req, res) => {
    const { city, state, isAvailable, minCapacity } = req.query;

    // Build filter
    const filter = {};
    if (city) filter.city = city;
    if (state) filter.state = state;
    if (isAvailable) filter.isAvailable = isAvailable === 'true';
    if (minCapacity) filter.availableCapacity = { $gte: Number(minCapacity) };

    const coldStorages = await ColdStorage.find(filter)
        .populate('owner', 'firstName lastName email phone')
        .sort({ createdAt: -1 });

    return res.json(
        new ApiResponse(200, { coldStorages, count: coldStorages.length }, "Cold storages fetched successfully")
    );
});

// Get Cold Storage by ID
const getColdStorageById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const coldStorage = await ColdStorage.findById(id)
        .populate('owner', 'firstName lastName email phone');

    if (!coldStorage) {
        throw new ApiError(404, "Cold storage not found");
    }

    return res.json(
        new ApiResponse(200, { coldStorage }, "Cold storage fetched successfully")
    );
});

// Get My Cold Storages (Owner)
const getMyColdStorages = asyncHandler(async (req, res) => {
    const coldStorages = await ColdStorage.find({ owner: req.user._id })
        .sort({ createdAt: -1 });

    return res.json(
        new ApiResponse(200, { coldStorages, count: coldStorages.length }, "Your cold storages fetched successfully")
    );
});

// Update Cold Storage
const updateColdStorage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Find cold storage
    const coldStorage = await ColdStorage.findById(id);

    if (!coldStorage) {
        throw new ApiError(404, "Cold storage not found");
    }

    // Check ownership
    if (coldStorage.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this cold storage");
    }

    // Update
    const updatedColdStorage = await ColdStorage.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
    );

    return res.json(
        new ApiResponse(200, { coldStorage: updatedColdStorage }, "Cold storage updated successfully")
    );
});

// Delete Cold Storage
const deleteColdStorage = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Find cold storage
    const coldStorage = await ColdStorage.findById(id);

    if (!coldStorage) {
        throw new ApiError(404, "Cold storage not found");
    }

    // Check ownership
    if (coldStorage.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this cold storage");
    }

    await ColdStorage.findByIdAndDelete(id);

    return res.json(
        new ApiResponse(200, {}, "Cold storage deleted successfully")
    );
});

// Toggle Availability
const toggleAvailability = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const coldStorage = await ColdStorage.findById(id);

    if (!coldStorage) {
        throw new ApiError(404, "Cold storage not found");
    }

    // Check ownership
    if (coldStorage.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this cold storage");
    }

    coldStorage.isAvailable = !coldStorage.isAvailable;
    await coldStorage.save();

    return res.json(
        new ApiResponse(200, { coldStorage }, `Cold storage ${coldStorage.isAvailable ? 'activated' : 'deactivated'} successfully`)
    );
});

export {
    createColdStorage,
    getAllColdStorages,
    getColdStorageById,
    getMyColdStorages,
    updateColdStorage,
    deleteColdStorage,
    toggleAvailability
};