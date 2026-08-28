/**
 * fractal-grid — KWin script for ultrawide monitor window management.
 *
 * A grid-based window layout manager for KDE Plasma that enables advanced
 * window positioning on ultrawide monitors. Provides customizable column layouts
 * with smart stacking, takeover modes, and keyboard shortcuts.
 *
 * @author Tyler Pate (TGPSKI), forked from lucmos (UltrawideWindows)
 * @license GPL-2.0-or-later
 * @see https://github.com/lucmos/UltrawideWindows
 * @see https://github.com/TGPSKI/fractal-grid
 *
 * Key Features:
 * - Percentage-based column width distribution
 * - Smart stacking: automatic window arrangement within columns
 * - Takeover mode: expand windows across multiple columns
 * - Frame margins: create layouts that don't maximize full screen
 * - Per-column padding and row configuration
 * 
 * KWin API Dependencies:
 * - workspace.activeWindow, workspace.windowList(), workspace.currentDesktop
 * - workspace.clientArea(), workspace.activeScreen, workspace.currentActivity
 * - KWin.MaximizeArea, registerShortcut()
 */

const debug = false;

/**
 * Log debug messages when debug mode is enabled.
 * @param {...any} args - Arguments to log
 */
function logDebug(...args) {
    if (debug) {
        console.log(...args);
    }
}

/**
 * Safely stringify an object for debug logging.
 * Falls back to a simple representation if JSON.stringify fails.
 * @param {any} obj - The object to stringify
 * @returns {string} JSON string or fallback representation
 */
function safeJsonStringify(obj) {
    try {
        return JSON.stringify(obj);
    } catch (e) {
        return String(obj);
    }
}

/**
 * Get the active window client with validation.
 * @returns {object|null} The active client if valid and manipulable, null otherwise
 */
function getActiveClient() {
    const client = workspace.activeWindow;
    if (!client || !client.moveable || !client.resizeable) {
        return null;
    }
    return client;
}

/**
 * Get the current desktop number, supporting both X11 and Wayland APIs.
 * @returns {number|null} The current desktop number or null if unavailable
 */
function getCurrentDesktopNum() {
    const currentDesktop = workspace.currentDesktop;
    if (typeof currentDesktop === 'number') {
        return Number(currentDesktop);
    } else if (currentDesktop && typeof currentDesktop.x11DesktopNumber !== 'undefined') {
        return Number(currentDesktop.x11DesktopNumber);
    } else if (currentDesktop && typeof currentDesktop.number !== 'undefined') {
        return Number(currentDesktop.number);
    }
    return null;
}

/**
 * Determine if a window should be considered on the current desktop.
 * Returns an exclude reason string if the window should be excluded, or null if it should be included.
 * 
 * KWin 6 API: window.desktops is an array of VirtualDesktop objects.
 * Each VirtualDesktop has x11DesktopNumber property.
 * If window.desktops is empty AND window.onAllDesktops is false, the window is NOT on all desktops
 * (contrary to older behavior). We must check the desktops array properly.
 * 
 * @param {object} window - The window object to check
 * @param {number|null} currentDeskNum - The current desktop's x11DesktopNumber
 * @returns {string|null} Exclude reason or null if window is on current desktop
 */
function isWindowOnCurrentDesktop(window, currentDeskNum) {
    // Check onAllDesktops first - sticky windows should be excluded from collision detection
    if (window.onAllDesktops) {
        return 'onAllDesktops';
    }

    // Check window.desktops array (KWin 6 API: array of VirtualDesktop objects)
    const windowDesktops = window.desktops;
    if (windowDesktops && typeof windowDesktops.length === 'number' && windowDesktops.length > 0) {
        // Window is assigned to specific desktops - check if current desktop is in the list
        let foundOnCurrentDesktop = false;
        for (let i = 0; i < windowDesktops.length; i++) {
            const vd = windowDesktops[i];
            if (vd && typeof vd.x11DesktopNumber !== 'undefined') {
                if (vd.x11DesktopNumber === currentDeskNum) {
                    foundOnCurrentDesktop = true;
                    break;
                }
            }
        }
        if (!foundOnCurrentDesktop) {
            return 'desktop-mismatch';
        }
    }

    // If we get here, either:
    // - Window's desktops array is empty (shouldn't happen for normal windows)
    // - Window is on the current desktop
    // In either case, we've passed the desktop check
    return null;
}

/**
 * Check if two geometries overlap.
 * @param {object} geom1 - First geometry {x, y, width, height}
 * @param {object} geom2 - Second geometry {x, y, width, height}
 * @returns {boolean} True if the geometries overlap
 */
function geometryOverlaps(geom1, geom2) {
    const horizontalOverlap = (geom1.x < geom2.x + geom2.width) && (geom1.x + geom1.width > geom2.x);
    const verticalOverlap = (geom1.y < geom2.y + geom2.height) && (geom1.y + geom1.height > geom2.y);
    return horizontalOverlap && verticalOverlap;
}

/**
 * Reposition and resize a window to the specified geometry.
 * @param {object} client - The KWin window client object
 * @param {number} newX - New X position (left edge)
 * @param {number} newY - New Y position (top edge)
 * @param {number} w - New width in pixels
 * @param {number} h - New height in pixels
 */
function reposition(client, newX, newY, w, h) {
    client.frameGeometry = {
        x: newX,
        y: newY,
        width: w,
        height: h
    }
}

/**
 * Collect all windows whose frameGeometry overlaps the provided column geometry.
 * Filters out minimized, hidden, and windows on other desktops/activities.
 * @param {object} columnGeom - The column geometry {x, y, width, height}
 * @returns {Array} Array of window objects that overlap with the column
 */
function collectWindowsInColumn(columnGeom) {
    const allWindows = workspace.windowList ? workspace.windowList() : [];
    logDebug("Total windows from workspace.windowList:", allWindows.length);

    const currentDeskNum = getCurrentDesktopNum();
    const included = [];
    const excluded = [];

    const result = allWindows.filter(window => {
        // Skip invalid windows and desktop background
        if (!window || !window.frameGeometry || window.desktopWindow) return false;

        let excludeReason = null;

        // Check visibility (minimized/hidden)
        if (window.minimized) excludeReason = 'minimized';
        if (!excludeReason && window.hidden) excludeReason = 'hidden';

        // Check desktop membership
        if (!excludeReason) {
            excludeReason = isWindowOnCurrentDesktop(window, currentDeskNum);
        }

        // Log window properties in debug mode
        if (debug) {
            // Extract desktop numbers from window.desktops array for logging
            let desktopNums = [];
            if (window.desktops && typeof window.desktops.length === 'number') {
                for (let i = 0; i < window.desktops.length; i++) {
                    const vd = window.desktops[i];
                    if (vd && typeof vd.x11DesktopNumber !== 'undefined') {
                        desktopNums.push(vd.x11DesktopNumber);
                    }
                }
            }
            logDebug("Window properties: " + safeJsonStringify({
                caption: window.caption || '<no-caption>',
                desktops: desktopNums,
                onAllDesktops: window.onAllDesktops,
                minimized: window.minimized,
                hidden: window.hidden,
                activities: window.activities,
                frame: window.frameGeometry,
            }));
        }

        // Check geometric overlap
        const overlapped = geometryOverlaps(window.frameGeometry, columnGeom);

        if (excludeReason || !overlapped) {
            excluded.push({ window, reason: excludeReason || 'no-overlap' });
            return false;
        }

        included.push(window);
        return true;
    });

    // Log summary in debug mode
    if (debug) {
        logDebug("collectWindowsInColumn: currentDesktop:", safeJsonStringify({
            raw: workspace.currentDesktop,
            num: currentDeskNum
        }));
        logDebug("Included windows:", safeJsonStringify(
            included.map(w => ({ caption: w.caption || '<no-caption>', desktop: w.desktop }))
        ));
        logDebug("Excluded windows:", safeJsonStringify(
            excluded.map(e => ({ caption: e.window.caption || '<no-caption>', desktop: e.window.desktop, reason: e.reason }))
        ));
    }

    return result;
}

/**
 * Validate and adjust column widths to fit the available screen width.
 * If total width is less than available, distributes excess proportionally.
 * @param {number[]} colWidths - Array of column widths in pixels
 * @param {number} horizMargin - Horizontal margin between columns
 * @param {number} maxWidth - Maximum available width
 * @returns {number[]} Adjusted column widths
 * @throws {Error} If columns plus margins exceed available width
 */
function validateColumnWidths(colWidths, horizMargin, maxWidth) {
    // Calculate total width including margins on both sides of each column
    let totalWidth = colWidths.reduce((sum, width) => sum + width, 0) + (colWidths.length + 1) * horizMargin;

    if (totalWidth > maxWidth) {
        throw new Error("Column widths plus margins exceed the available screen width.");
    }

    // Distribute any remaining width proportionally to existing column widths
    if (totalWidth < maxWidth) {
        const remainingWidth = maxWidth - totalWidth;
        const weights = colWidths;
        const sum = weights.reduce((a,b) => a+b, 0);

        for (let i = 0; i < colWidths.length; i++) {
            colWidths[i] += Math.round(remainingWidth * (weights[i] / sum));
        }
    }

    return colWidths;
}

/**
 * Calculate the X positions for each column based on widths and margins.
 * @param {number[]} colWidths - Array of column widths in pixels
 * @param {number} horizMargin - Horizontal margin between columns
 * @returns {number[]} Array of X positions for each column's left edge
 */
function calculateColumnPositions(colWidths, horizMargin) {
    const positions = [];
    let currentPosition = horizMargin;  // Start after left margin

    colWidths.forEach(width => {
        positions.push(currentPosition);
        currentPosition += width + horizMargin;  // Move past column and margin
    });

    return positions;
}

// =============================================================================
// GLOBAL SCREEN GEOMETRY
// =============================================================================
// Cached screen geometry, calculated once and updated on screen size changes.
// All layout generators reference this shared value.
// =============================================================================

/** @type {{x: number, y: number, width: number, height: number}} */
let globalMaxArea = null;

/**
 * Calculate and cache the global screen geometry.
 * Called at initialization and when screen size changes.
 */
function updateGlobalMaxArea() {
    globalMaxArea = workspace.clientArea(KWin.MaximizeArea, workspace.activeScreen, workspace.currentDesktop);
    logDebug("Global maxArea updated:", safeJsonStringify({
        x: globalMaxArea.x, y: globalMaxArea.y,
        width: globalMaxArea.width, height: globalMaxArea.height
    }));
}

// Initialize global geometry
updateGlobalMaxArea();

/**
 * Factory function that creates a grid layout placement function.
 * 
 * The generated function positions windows into a configurable column-based grid.
 * Each column can have its own width percentage, takeover capability, and row behavior.
 * 
 * ALL MEASUREMENTS ARE IN PERCENTAGES relative to screen dimensions:
 * - Horizontal values (horizMargin, frameHorizMargin, columnPadding) are % of screen WIDTH
 * - Vertical values (vertMargin, frameVertMargin, rowVertMargin, minWindowHeight) are % of screen HEIGHT
 * 
 * @param {number} columns - Number of columns in the grid (default: 3)
 * @param {object} style - Layout configuration options (all values in percentages):
 * 
 * @param {number} style.horizMarginPct - Horizontal margin between columns as % of screen width (default: 1.3)
 * @param {number} style.vertMarginPct - Vertical margin from top/bottom of frame as % of screen height (default: 2.6)
 * @param {number[]} style.columnWidthPercentages - Width distribution as percentages, must sum to ~100
 *   Example: [29, 57, 12] creates a narrow-wide-narrow layout
 * 
 * @param {number[]} style.enableTakeover - Per-column takeover mode flags (0=disabled, 1=enabled)
 *   When enabled, { takeover: true } option expands window to include adjacent column(s)
 *   Columns 0 and 1 both expand to cover columns 0+1 when takeover is triggered
 * 
 * @param {number[]} style.enableRows - Per-column smart stacking configuration:
 *   - 0: Disabled - window fills entire column height
 *   - 1+: Enabled - triggers smart stacking algorithm (see stackInColumn):
 *     * Empty column: new window fills entire height
 *     * Full-height window exists: split column in half (if minWindowHeight allows)
 *     * Partial windows exist: append below bottom-most window (if space allows)
 *   The number value is also used by computeRowGeometry for explicit row placement
 * 
 * @param {number} style.rowVertMarginPct - Vertical margin between stacked windows as % of screen height (default: 1.0)
 * @param {number} style.minWindowHeightPct - Minimum window height as % of screen height (default: 5.2)
 *   Smart stacking operations that would violate this constraint are skipped
 * 
 * @param {number} style.frameHorizMarginPct - Horizontal inset from screen edges as % of screen width (default: 0)
 *   Creates a "frame" within the screen where all columns are laid out
 * @param {number} style.frameVertMarginPct - Vertical inset from screen edges as % of screen height (default: 0)
 * 
 * @param {number[]|false} style.columnPaddingPct - Per-column vertical padding as % of screen height (default: false)
 *   When array, each value is applied as top AND bottom padding for that column
 *   Example: [3.9, 0, 3.9] adds ~75px padding on 1920px height to columns 0 and 2
 * 
 * @returns {function} place(columnIndex, options) - Window placement function
 *   - place(columnIndex): Place active window in specified column
 *   - place(columnIndex, { takeover: true }): Place with takeover expansion
 *   - place(columnIndex, { row: N }): Place in specific row (when rows disabled)
 *   - place.getColumnGeometry(columnIndex): Get column bounds {x, y, width, height}
 *   - place.style: Reference to the style configuration
 *   - place.columns: Number of columns
 *   - place.recalculateGeometry(): Manually trigger geometry recalculation
 */
function gridLayoutGenerator(
    columns = 3,
    style = {
        horizMarginPct: 1.3,           // ~50px on 3840px width
        vertMarginPct: 2.6,            // ~50px on 1920px height
        columnWidthPercentages: [29, 57, 12],
        enableTakeover: [1, 1, 0],
        enableRows: [0, 0, 1],
        rowVertMarginPct: 1.6,         // ~30px on 1920px height
        minWindowHeightPct: 5.2,       // ~100px on 1920px height
        frameHorizMarginPct: 0,  
        frameVertMarginPct: 0,  
        columnPaddingPct: false   
    }
) {
    // Validate style configuration upfront
    if (style.columnWidthPercentages.length !== columns) {
        throw new Error("columnWidthPercentages length must equal columns");
    }

    // Cached layout-specific geometry - recalculated on screen size changes
    let frameArea, colWidths, colPositions;
    // Computed pixel values from percentages (recalculated on screen size change)
    let horizMargin, vertMargin, rowVertMargin, minWindowHeight, frameHorizMargin, frameVertMargin, columnPadding;

    /**
     * Recalculate layout-specific geometry based on global maxArea.
     * Converts percentage-based style values to pixels based on current screen dimensions.
     * Called at initialization and when screen size changes.
     */
    function recalculateGeometry() {
        const screenWidth = globalMaxArea.width;
        const screenHeight = globalMaxArea.height;
        
        // Convert percentage values to pixels
        horizMargin = Math.round(screenWidth * (style.horizMarginPct / 100));
        vertMargin = Math.round(screenHeight * (style.vertMarginPct / 100));
        rowVertMargin = Math.round(screenHeight * (style.rowVertMarginPct / 100));
        minWindowHeight = Math.round(screenHeight * (style.minWindowHeightPct / 100));
        frameHorizMargin = Math.round(screenWidth * (style.frameHorizMarginPct / 100));
        frameVertMargin = Math.round(screenHeight * (style.frameVertMarginPct / 100));
        
        // Convert column padding percentages to pixels
        if (style.columnPaddingPct && Array.isArray(style.columnPaddingPct)) {
            columnPadding = style.columnPaddingPct.map(p => Math.round(screenHeight * (p / 100)));
        } else {
            columnPadding = false;
        }
        
        // Calculate frame area (layout area within frame margins)
        frameArea = {
            x: globalMaxArea.x + frameHorizMargin,
            y: globalMaxArea.y + frameVertMargin,
            width: screenWidth - 2 * frameHorizMargin,
            height: screenHeight - 2 * frameVertMargin
        };
        
        const totalWidth = frameArea.width - (columns + 1) * horizMargin;
        colWidths = style.columnWidthPercentages.map(p => Math.round(totalWidth * (p / 100)));
        validateColumnWidths(colWidths, horizMargin, frameArea.width);
        colPositions = calculateColumnPositions(colWidths, horizMargin);
        
        logDebug("Layout geometry recalculated:", safeJsonStringify({
            screenSize: { width: screenWidth, height: screenHeight },
            frameArea: { width: frameArea.width, height: frameArea.height },
            margins: { horiz: horizMargin, vert: vertMargin, rowVert: rowVertMargin },
            colWidths: colWidths
        }));
    }

    // Initial geometry calculation
    recalculateGeometry();
    
    function getAdjustedColumnHeight(columnIndex) {
        let height = frameArea.height - 2 * vertMargin;
        if (columnPadding && Array.isArray(columnPadding) && columnIndex < columnPadding.length) {
            height -= 2 * columnPadding[columnIndex];
        }
        return height;
    }

    function computeRowGeometry(columnIndex, rowIndex, columnHeight) {
        const rowsEnabled = style.enableRows[columnIndex];
        if (!rowsEnabled) {
            return { y: frameArea.y + vertMargin, height: columnHeight };
        }
        const usableHeight = columnHeight - (rowsEnabled - 1) * rowVertMargin;
        const eachHeight = Math.floor(usableHeight / rowsEnabled);
        const y = frameArea.y + vertMargin + rowIndex * (eachHeight + rowVertMargin);
        return { y: y, height: eachHeight };
    }

    function takeoverWidth(columnIndex) {
        if (!style.enableTakeover[columnIndex]) return colWidths[columnIndex];
        if (columnIndex === 0 && columns > 1) {
            return colWidths[0] + colWidths[1] + horizMargin;
        }
        if (columnIndex === 1 && columns > 1) {
            return colWidths[0] + colWidths[1] + horizMargin;
        }
        return colWidths[columnIndex];
    }

    function getColumnGeometry(columnIndex) {
        const baseY = frameArea.y + vertMargin;
        const baseHeight = frameArea.height - 2 * vertMargin;
        let y = baseY;
        let height = baseHeight;
        if (columnPadding && Array.isArray(columnPadding) && columnIndex < columnPadding.length) {
            const pad = columnPadding[columnIndex];
            y += pad;
            height -= 2 * pad;
        }
        return {
            x: frameArea.x + colPositions[columnIndex],
            y: y,
            width: colWidths[columnIndex],
            height: height
        };
    }

    function place(columnIndex, options = {}) {
        const activeClient = getActiveClient();
        if (!activeClient) return;

        activeClient.setMaximize(false, false);
        if (columnIndex < 0 || columnIndex >= columns) throw new Error("Invalid columnIndex");

        const takeover = options.takeover === true;
        const rowsEnabled = style.enableRows[columnIndex];

        // If rows are enabled for this column and no explicit row index, use smart stacking
        if (rowsEnabled && !takeover) {
            stackInColumn(columnIndex);
            return;
        }

        // Standard placement logic
        const rowIndex = typeof options.row === 'number' ? options.row : 0;
        const columnX = frameArea.x + colPositions[columnIndex];
        const columnHeight = getAdjustedColumnHeight(columnIndex);
        const rowGeom = computeRowGeometry(columnIndex, rowIndex, columnHeight);
        let w = takeover ? takeoverWidth(columnIndex) : colWidths[columnIndex];
        let x = columnX;
        if (takeover && (columnIndex === 1)) {
            x = frameArea.x + colPositions[0];
        }
        reposition(activeClient, x, rowGeom.y, w, rowGeom.height);
    }

    /**
     * Smart stacking algorithm for placing windows in a column.
     * 
     * Algorithm behavior:
     * 1. EMPTY COLUMN: Place window to fill entire column height
     * 2. FULL-HEIGHT WINDOW EXISTS: Split the column in half vertically
     *    - Resize existing window to top half
     *    - Place new window in bottom half
     *    - Skipped if half-height < minWindowHeight
     * 3. PARTIAL WINDOWS EXIST: Append below the bottom-most window
     *    - Calculate remaining space below existing windows
     *    - Place new window in remaining space
     *    - Skipped if remaining height < minWindowHeight
     * 
     * @param {number} columnIndex - Index of the column to stack into
     */
    function stackInColumn(columnIndex) {
        const activeClient = getActiveClient();
        if (!activeClient) return;

        const columnGeom = getColumnGeometry(columnIndex);
        // Use computed pixel values from recalculateGeometry()
        const stackRowVertMargin = rowVertMargin;
        const stackMinWindowHeight = minWindowHeight;

        // Collect windows that overlap with this column's geometry.
        // This filters out: minimized, hidden, other desktops/activities, non-overlapping
        const overlappingWindows = collectWindowsInColumn(columnGeom);
        logDebug("Overlapping windows count:", overlappingWindows.length);

        // Exclude the active client from collision detection
        // (we're placing it, not detecting collision with it)
        const columnWindows = overlappingWindows.filter(c => {
            return c !== activeClient;
        });

        logDebug(`Found ${columnWindows.length} windows in column ${columnIndex}`);

        // CASE 1: Empty column - fill entire height
        if (columnWindows.length === 0) {
            logDebug("No windows in column, filling entire space");
            reposition(activeClient, columnGeom.x, columnGeom.y, columnGeom.width, columnGeom.height);
            return;
        }

        // CASE 2: Check for full-height window (within 5px tolerance for rounding)
        // If found, we'll split the column in half
        const fullHeightWindow = columnWindows.find(c => {
            const g = c.frameGeometry;
            return Math.abs(g.y - columnGeom.y) <= 5 &&
                   Math.abs(g.height - columnGeom.height) <= 5;
        });

        if (fullHeightWindow) {
            // Split logic: resize existing window to half, place new window in other half
            const halfHeight = Math.floor((columnGeom.height - stackRowVertMargin) / 2);
            
            // Check if half height meets minimum requirements
            if (halfHeight < stackMinWindowHeight) {
                logDebug("Cannot split: half height would be less than minWindowHeight");
                return; // Do nothing if constraints can't be satisfied
            }
            
            logDebug("Full-height window found, splitting column");
            // Resize existing window to top half
            reposition(fullHeightWindow,
                       columnGeom.x,
                       columnGeom.y,
                       columnGeom.width,
                       halfHeight);

            // Place new window in bottom half
            reposition(activeClient,
                       columnGeom.x,
                       columnGeom.y + halfHeight + stackRowVertMargin,
                       columnGeom.width,
                       halfHeight);
            return;
        }

        // CASE 3: Partial windows exist - append new window to fill remaining space
        logDebug("Appending window at bottom of column");
        // Sort by Y position to find the bottom-most window
        columnWindows.sort((a, b) => a.frameGeometry.y - b.frameGeometry.y);

        let totalUsedHeight = 0;
        columnWindows.forEach(c => {
            totalUsedHeight += c.frameGeometry.height + stackRowVertMargin;
        });

        const remainingHeight = columnGeom.height - totalUsedHeight;

        // Check if remaining height meets minimum requirements
        if (remainingHeight < stackMinWindowHeight) {
            logDebug("Cannot append: remaining height would be less than minWindowHeight");
            return; // Do nothing if constraints can't be satisfied
        }

        const lastWindow = columnWindows[columnWindows.length - 1];
        const newY = lastWindow.frameGeometry.y + lastWindow.frameGeometry.height + stackRowVertMargin;

        reposition(activeClient,
                   columnGeom.x,
                   newY,
                   columnGeom.width,
                   remainingHeight);
    }

    // Expose methods and properties
    place.getColumnGeometry = getColumnGeometry;
    place.recalculateGeometry = recalculateGeometry;
    place.style = style;
    place.columns = columns;

    return place;
}


// =============================================================================
// LAYOUT CONFIGURATIONS
// =============================================================================
// Each configuration creates a placement function with specific column widths,
// margins, and stacking behaviors. Customize these for your monitor setup.
// 
// ALL VALUES ARE IN PERCENTAGES:
// - Horizontal values (horizMarginPct, frameHorizMarginPct) = % of screen WIDTH
// - Vertical values (vertMarginPct, frameVertMarginPct, etc.) = % of screen HEIGHT
// =============================================================================

/**
 * Three-column layout optimized for ultrawide monitors.
 * - Left column (29%): Secondary content, navigation
 * - Center column (57%): Primary workspace, code editor
 * - Right column (12%): Narrow utility column with smart stacking
 */
const threeCol = gridLayoutGenerator(3, {
    horizMarginPct: 1.3,              // ~50px on 3840px width
    vertMarginPct: 2.6,               // ~50px on 1920px height
    columnWidthPercentages: [29, 57, 12], // ~1110px, 2180px, 460px on 3840px width
    enableTakeover: [1, 1, 0],
    enableRows: [0, 0, 1],
    rowVertMarginPct: 1.0,            // ~20px on 1920px height
    minWindowHeightPct: 5.2,          // ~100px on 1920px height
    frameHorizMarginPct: 0,  
    frameVertMarginPct: 0,    
    columnPaddingPct: false
});

const twoColHealthyMargins = gridLayoutGenerator(2, {
    horizMarginPct: 2.6,              // ~100px on 3840px width
    vertMarginPct: 5.2,               // ~100px on 1920px height
    columnWidthPercentages: [60, 40], // ~2300px, 1540px on 3840px width
    enableTakeover: [1, 1],
    enableRows: [1, 1],
    rowVertMarginPct: 1.0,            // ~20px on 1920px height
    minWindowHeightPct: 5.2,          // ~100px on 1920px height
    frameHorizMarginPct: 0,  
    frameVertMarginPct: 0,    
    columnPaddingPct: false
});

const twoColWithRows = gridLayoutGenerator(2, {
    horizMarginPct: 1.3,              // ~50px on 3840px width
    vertMarginPct: 2.6,               // ~50px on 1920px height
    columnWidthPercentages: [50, 50], // ~1920px, 1920px on 3840px width
    enableTakeover: [1, 1],
    enableRows: [1, 1],
    rowVertMarginPct: 1.0,            // ~20px on 1920px height
    minWindowHeightPct: 5.2,          // ~100px on 1920px height
    frameHorizMarginPct: 0,  
    frameVertMarginPct: 0,    
    columnPaddingPct: false
});

const twoColWithRowsFramed = gridLayoutGenerator(2, {
    horizMarginPct: 1.3,              // ~50px on 3840px width
    vertMarginPct: 2.6,               // ~50px on 1920px height
    columnWidthPercentages: [50, 50], // ~1920px, 1920px on 3840px width
    enableTakeover: [1, 1],
    enableRows: [1, 1],
    rowVertMarginPct: 1.0,            // ~20px on 1920px height
    minWindowHeightPct: 5.2,          // ~100px on 1920px height
    frameHorizMarginPct: 13.0,        // ~500px on 3840px width
    frameVertMarginPct: 10.4,         // ~200px on 1920px height
    columnPaddingPct: false
});

/**
 * Framed three-column layout with margins from screen edges.
 * Creates a centered workspace with generous padding.
 */
const framedThreeCol = gridLayoutGenerator(3, {
    horizMarginPct: 0.65,             // ~25px on 3840px width
    vertMarginPct: 2.6,               // ~50px on 1920px height
    columnWidthPercentages: [20, 40, 20], // ~768px, 1536px, 768px on 3840px width
    enableTakeover: [0, 0, 0],
    enableRows: [1, 0, 1],
    rowVertMarginPct: 1.3,            // ~25px on 1920px height
    minWindowHeightPct: 5.2,          // ~100px on 1920px height
    frameHorizMarginPct: 7.8,         // ~300px on 3840px width
    frameVertMarginPct: 10.4,         // ~200px on 1920px height
    columnPaddingPct: [3.9, 0, 3.9]   // ~75px on 1920px height
});

// =============================================================================
// SCREEN SIZE CHANGE HANDLING
// =============================================================================
// Event-driven geometry recalculation when screen configuration changes.
// Handles docking/undocking laptops, resolution changes, monitor hotplug.
// =============================================================================

/**
 * Array of all layout generators that need geometry recalculation on screen changes.
 */
const allLayouts = [threeCol, twoColHealthyMargins, twoColWithRows, twoColWithRowsFramed, framedThreeCol];

/**
 * Recalculate geometry for all layout generators.
 * Called when virtual screen size changes (dock/undock, resolution change, etc.)
 */
function recalculateAllGeometry() {
    const newSize = workspace.virtualScreenSize;
    logDebug("Screen size changed to " + newSize.width + "x" + newSize.height + ", recalculating geometry...");
    
    // Update global maxArea once
    updateGlobalMaxArea();
    
    // Then update each layout's derived geometry
    allLayouts.forEach(function(layout) {
        try {
            layout.recalculateGeometry();
        } catch (e) {
            logDebug("Error recalculating layout geometry: " + e);
        }
    });
    
    logDebug("Geometry recalculation complete");
}

// Connect to the virtualScreenSizeChanged signal to handle screen configuration changes
workspace.virtualScreenSizeChanged.connect(recalculateAllGeometry);

// =============================================================================
// KEYBOARD SHORTCUTS
// =============================================================================
// All shortcuts use the "fractal-grid:" prefix for discoverability in KDE settings.
// Customize key bindings in System Settings > Shortcuts > KWin
// =============================================================================

// --- Framed Three-Column Layout (Ctrl+Alt+Meta + D/B/H) ---
registerShortcut("ThreeColFramedLeft", "fractal-grid: ThreeCol Framed Place Left", "Ctrl+Alt+Meta+D", function () {
    framedThreeCol(0);
});

registerShortcut("ThreeColFramedCenter", "fractal-grid: ThreeCol Framed Place Center", "Ctrl+Alt+Meta+B", function () {
    framedThreeCol(1);
});

registerShortcut("ThreeColFramedRight", "fractal-grid: ThreeCol Framed Place Right", "Ctrl+Alt+Meta+H", function () {
    framedThreeCol(2);
});

// --- Standard Three-Column Layout (Ctrl+Alt+Meta + E/C/T/R) ---
registerShortcut("ThreeColLeft", "fractal-grid: ThreeCol Place Left", "Ctrl+Alt+Meta+E", function () {
    threeCol(0);
});

registerShortcut("ThreeColCenter", "fractal-grid: ThreeCol Place Center", "Ctrl+Alt+Meta+C", function () {
    threeCol(1);
});

registerShortcut("ThreeColRight", "fractal-grid: ThreeCol Place Right", "Ctrl+Alt+Meta+T", function () {
    threeCol(2);
});

registerShortcut("ThreeColCenterTakeover", "fractal-grid: ThreeCol Center Takeover", "Ctrl+Alt+Meta+J", function () {
    threeCol(1, { takeover: true });
});

// --- Two-Column Framed Layout (Ctrl+Alt+Meta + M/K) ---
registerShortcut("TwoColFramedLeft", "fractal-grid: Two Column Framed Left", "Ctrl+Alt+Meta+M", function () {
    twoColWithRowsFramed(0);
});

registerShortcut("TwoColFramedRight", "fractal-grid: Two Column Framed Right", "Ctrl+Alt+Meta+K", function () {
    twoColWithRowsFramed(1);
});

// --- Two-Column Healthy Margins Layout (Ctrl+Alt+Meta + ,/L) ---
registerShortcut("TwoColHealthyMarginsLeft", "fractal-grid: Two Column Healthy Margins Left", "Ctrl+Alt+Meta+,", function () {
    twoColHealthyMargins(0);
});

registerShortcut("TwoColHealthyMarginsRight", "fractal-grid: Two Column Healthy Margins Right", "Ctrl+Alt+Meta+L", function () {
    twoColHealthyMargins(1);
});

