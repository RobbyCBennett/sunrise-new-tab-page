// Keys
const BACKSPACE = 8;
const ENTER     = 13;
const ESCAPE    = 27;
const SPACE     = 32;
const UP        = 38;
const DOWN      = 40
const DELETE    = 46;
const ZERO      = 48;
const NINE      = 57;
const Z         = 90;



// Links

// Main click, other click, and keypress
function clickAndKeypress(el, fn) {
	el.onclick = fn;
	el.onauxclick = fn;
	el.onkeypress = fn;
}

// Link: Big options page
function bigOptions(e) {
	// Skip other keys or right click
	if ((e.keyCode && e.keyCode != ENTER) || e.button == 2) {
		return;
	}

	// Create tab
	chrome.runtime.openOptionsPage();
}
const bigOptionsLink = document.getElementById('bigOptions');
clickAndKeypress(bigOptionsLink, bigOptions);
if (location.hash != '#popup') {
	bigOptionsLink.className = 'hidden';
}



// Options

// Load all options
async function loadOptions() {
	const options = await chrome.storage.local.get();

	// View options on inputs
	for (const [key, value] of Object.entries(options)) {
		const field = document.getElementById(key);
		if (! field) continue;

		if (field.type == 'checkbox') {
			// Load option
			field.checked = value;

			// Hide/show the options
			if (! value) toggleOptions(field);
		}
		else if (field.type == 'range') {
			// Load option
			field.value = value;
			const id = field.id + 'Number';
			document.getElementById(id).value = value;
		}
		else if (field.type == 'file') {
			// Load option
			document.getElementById(key).style.backgroundImage = `url(${value})`;
		}
		else {
			// Load option
			field.value = value;

			// Select the option
			if (field.classList.contains('select')) {
				selectOption({}, field, value)
			}
		}
	}
}
loadOptions();

// Save changed option
let autoSaveTimestamp = 0;
function saveOption(key, value, autoSaveDelay=0) {
	autoSaveTimestamp = Date.now();

	setTimeout(() => {
		// Wait a bit until the user stops
		if (autoSaveTimestamp + autoSaveDelay > Date.now())
			return;

		// Save data
		chrome.storage.local.set({ [key]: value });

		// Remove close warning
		window.onbeforeunload = null;

	}, autoSaveDelay);
}

// Show/hide options
function toggleOptions(el) {
	const hideClass = el.dataset.hide;
	if (hideClass) {
		for (const option of document.getElementsByClassName(hideClass)) {
			option.classList.toggle('hidden');
		}
	}
}



// Inputs

// Checkbox changed
function checkboxChanged(e) {
	const target = e.target;

	const key = target.id;
	const value = target.checked;

	// Hide/show the options
	toggleOptions(target);

	// Set option with storage local immediately
	saveOption(key, value);
}
// Checkbox setup
for (const checkbox of document.querySelectorAll('input[type="checkbox"]')) {
	checkbox.oninput = checkboxChanged;
}

// Text, color, textarea changed
function otherChanged(e) {
	const key = e.target.id;
	const value = e.target.value;

	// Set option with storage local after the user stops typing
	saveOption(key, value, 750);
}
// Text, color, textarea setup
for (const input of document.querySelectorAll('input[type="text"], input[type="color"], textarea')) {
	input.oninput = otherChanged;
}

// Range changed
function rangeChanged(e) {
	const target = e.target;
	let value = parseInt(target.value);

	// Sync range & input
	let otherId, key;
	if (target.type == 'range') {
		// Get key
		key = target.id;

		// Get id of number input
		otherId = key + 'Number';

		// Make number input invalid
		document.getElementById(otherId).classList.remove('invalid');
	}
	else {
		// Get key
		key = target.id.slice(0, -6)

		// Make value stay in range and style as invalid
		const min = parseInt(target.dataset.min);
		const max = parseInt(target.dataset.max);
		const below = value < min;
		if (below || value > max) {
			// Make value stay in range
			if (below) value = min;
			else value = max;

			// Style as invalid
			target.classList.add('invalid');
		}
		else {
			target.classList.remove('invalid');
		}

		// Get id of range input
		otherId = key;
	}
	document.getElementById(otherId).value = value;

	// Set option with storage local after the user stops using the slider
	saveOption(key, value, 250);
}
// Range setup
function rangeNumber(e) {
	if (e.keyCode == BACKSPACE || e.keyCode == DELETE || (e.keyCode >= ZERO && e.keyCode <= NINE)) {
		const id = e.target.id + 'Number';
		const number = document.getElementById(id);
		number.value = '';
		number.focus();
	}
}
for (const range of document.querySelectorAll('input[type="range"]')) {
	// Go to number input on key down
	range.onkeydown = rangeNumber;

	// Make container for range, number, & unit
	const containerAll = document.createElement('div');
	containerAll.className = 'flex'
	range.parentNode.appendChild(containerAll);
	containerAll.appendChild(range);

	// Make container for number & unit
	const container = document.createElement('div');
	container.className = 'rangeNumberAndUnit flex'
	containerAll.appendChild(container);

	// Make number input
	const number = document.createElement('input');
	number.type = 'number';
	number.className = 'rangeNumber';
	number.dataset.min = range.min;
	number.dataset.max = range.max;
	number.id = range.id + 'Number';
	number.tabIndex = -1;
	container.appendChild(number);

	// Make number input unit
	const unit = range.dataset.unitSup || range.dataset.unit;
	if (unit) {
		const unitTagName = range.dataset.unitSup ? 'sup' : 'small';

		const unitContainer = document.createElement('div');
		unitContainer.className = 'rangeNumberUnit flex';
		container.appendChild(unitContainer);

		const unitElement = document.createElement(unitTagName);
		unitElement.innerHTML = unit;
		unitContainer.appendChild(unitElement);
	}

	// Sync both inputs
	range.oninput = rangeChanged;
	number.oninput = rangeChanged;
}

// File changed
function fileChanged(e) {
	const target = e.target;
	const key = target.id;
	const image = target.files[0];

	// Read file as data URL
	const reader = new FileReader();
	reader.readAsDataURL(image);
	reader.onload = e => {
		const value = e.target.result;

		// Set option with storage local
		saveOption(key, value);

		// Preview image
		target.style.backgroundImage = `url(${value})`;
	}
}
// File setup
for (const input of document.querySelectorAll('input[type="file"]')) {
	input.oninput = fileChanged;
}



// Select setup
let lastSelectEventType = null;
function selectToggle(e, open=null) {
	const select = e.target;

	// Skip double events from mousedown and focus
	if (lastSelectEventType == 'mousedown' && e.type == 'focus') {
		return;
	}

	// Show/hide the options
	if (e.type == 'blur' || open == false) {
		select.classList.add('hiddenOptions');
	}
	else if (open == true) {
		select.classList.remove('hiddenOptions');
	}
	else {
		select.classList.toggle('hiddenOptions');
	}

	// Keep track of the last event type
	lastSelectEventType = e.type;
}
function selectKey(e) {
	// Skip modifiers
	if (e.altKey || e.ctrlKey || e.shiftKey) {
		return;
	}

	// Enter
	if (e.keyCode == ENTER) {
		// Toggle select
		selectToggle(e);
	}

	// Escape
	if (e.keyCode == ESCAPE) {
		// Close select
		selectToggle(e, false);
	}

	// Space
	else if (e.keyCode == SPACE) {
		// Don't scroll down
		e.preventDefault();

		// Open select
		selectToggle(e, true);
	}

	// Arrow or alphanumeric text
	else if (e.keyCode == UP || e.keyCode == DOWN || (e.keyCode >= ZERO && e.keyCode <= Z)) {
		// Don't scroll up/down
		e.preventDefault();

		// Select option using key
		selectOption(e);
	}
}
function selectOption(e, element=null, value=null) {
	const target = e.target;

	// Get select, option, and autoSaveDelay
	let select, option, autoSaveDelay, innerHTML;
	if (e.type == 'mousedown') {
		// Get select from id of target parent minus 'Options'
		select = document.getElementById(target.parentElement.id.slice(0, -7));

		// Get option from mouse event
		option = target;

		autoSaveDelay = 0;
	}
	else if (e.type == 'keydown') {
		// Get select from key event
		select = target;

		// Get option from arrow
		const oldOption = select.parentElement.querySelector('.selected');
		const options = document.getElementById(select.id + 'Options');
		if (e.keyCode == UP || e.keyCode == DOWN) {
			// Get position
			let i = oldOption ? oldOption.dataset.i : null;

			// Change position
			if (i == null) {
				i = 0;
			}
			else if (e.keyCode == UP) {
				if (i == 0)
					return;
				i--;
			}
			else if (e.keyCode == DOWN) {
				if (i == options.children.length - 1)
					return;
				i++;
			}

			option = options.children[i];
		}
		// Get option from alphanumeric text
		else if (e.keyCode >= ZERO && e.keyCode <= Z) {
			for (const otherOption of options.children) {
				const char = otherOption.innerHTML[0].toLowerCase();
				if (char == e.key) {
					if (otherOption == oldOption)
						return;
					option = otherOption;
					break;
				}
			}
		}

		autoSaveDelay = 750;
	}
	else if (e.type == undefined) {
		// Get select from calling function
		select = element;

		// Get option from id of select element + 'Options, then value
		const options = document.getElementById(select.id + 'Options');
		for (const otherOption of options.children) {
			if (otherOption.value == value) {
				option = otherOption;
				break;
			}
		}
	}

	// Unselect old option
	const oldOption = select.parentElement.querySelector('.selected');
	if (oldOption) oldOption.classList.remove('selected');

	// Select option
	select.value = option.value;
	select.innerHTML = option.innerHTML;
	option.classList.add('selected');

	// Save option if there was an event
	if (e.type != undefined) {
		saveOption(select.id, option.value, autoSaveDelay);
	}
}
const oldSelects = document.getElementsByTagName('select');
for (let i = oldSelects.length - 1; i >= 0; i--) {
	const oldSelect = oldSelects[i];

	// Make select container
	const container = document.createElement('div');
	oldSelect.parentNode.appendChild(container);

	// Make select button
	const select = document.createElement('button');
	select.id = oldSelect.id;
	select.readOnly = true;
	select.className = 'select hiddenOptions';
	select.onfocus = select.onmousedown = select.onblur = selectToggle;
	select.onkeydown = selectKey;
	container.appendChild(select);

	// Make options container
	const options = document.createElement('div');
	options.id = oldSelect.id + 'Options';
	options.className = 'options';
	container.appendChild(options);

	// Move options
	let j = 0;
	while (oldSelect.children.length) {
		const option = oldSelect.firstElementChild;
		option.onmousedown = selectOption;
		option.dataset.i = j;
		options.appendChild(option);
		j++;
	}

	// Remove old select
	oldSelect.remove();
}
