--!nonstrict
-- A small, STRICT mock of the Roblox API pieces that Sword Forge scripts use.
-- It errors on unknown properties/methods/enum items and on wrongly typed values,
-- so typos in the generated Luau are caught by the tests instead of in Studio.
-- Time is virtual: nothing happens until Mock.step() / Mock.run() is called.

local Mock = { errors = {}, warnings = {}, now = 0, frame = 0, selection = {} }
_G.Mock = Mock

local realTypeof = typeof
local function typeOf(v)
	if type(v) == "table" then
		local mt = getmetatable(v)
		if mt and mt.__type then
			return mt.__type
		end
	end
	return realTypeof(v)
end
typeof = typeOf

local function copyList(t)
	local out = {}
	for i, v in ipairs(t) do
		out[i] = v
	end
	return out
end

------------------------------------------------------------------ Vector3 / Vector2
local Vector3mt = { __type = "Vector3" }
local function newV3(x, y, z)
	return setmetatable({ X = x, Y = y, Z = z }, Vector3mt)
end
local V3methods = {}
function V3methods.Dot(a, b)
	return a.X * b.X + a.Y * b.Y + a.Z * b.Z
end
function V3methods.Cross(a, b)
	return newV3(a.Y * b.Z - a.Z * b.Y, a.Z * b.X - a.X * b.Z, a.X * b.Y - a.Y * b.X)
end
function V3methods.Lerp(a, b, t)
	return newV3(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t, a.Z + (b.Z - a.Z) * t)
end
Vector3mt.__index = function(v, k)
	if k == "Magnitude" then
		return math.sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z)
	elseif k == "Unit" then
		local m = math.sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z)
		if m == 0 then
			return newV3(0, 0, 0)
		end
		return newV3(v.X / m, v.Y / m, v.Z / m)
	end
	local f = V3methods[k]
	if f then
		return f
	end
	error(tostring(k) .. " is not a valid member of Vector3", 2)
end
Vector3mt.__add = function(a, b)
	return newV3(a.X + b.X, a.Y + b.Y, a.Z + b.Z)
end
Vector3mt.__sub = function(a, b)
	return newV3(a.X - b.X, a.Y - b.Y, a.Z - b.Z)
end
Vector3mt.__mul = function(a, b)
	if type(a) == "number" then
		return newV3(a * b.X, a * b.Y, a * b.Z)
	elseif type(b) == "number" then
		return newV3(a.X * b, a.Y * b, a.Z * b)
	end
	return newV3(a.X * b.X, a.Y * b.Y, a.Z * b.Z)
end
Vector3mt.__div = function(a, b)
	if type(b) == "number" then
		return newV3(a.X / b, a.Y / b, a.Z / b)
	end
	return newV3(a.X / b.X, a.Y / b.Y, a.Z / b.Z)
end
Vector3mt.__unm = function(a)
	return newV3(-a.X, -a.Y, -a.Z)
end
Vector3mt.__eq = function(a, b)
	return a.X == b.X and a.Y == b.Y and a.Z == b.Z
end
Vector3mt.__tostring = function(a)
	return a.X .. ", " .. a.Y .. ", " .. a.Z
end
Vector3 = {
	new = function(x, y, z)
		assert(x == nil or type(x) == "number", "Vector3.new: number expected")
		return newV3(x or 0, y or 0, z or 0)
	end,
}
Vector3.zero = newV3(0, 0, 0)
Vector3.one = newV3(1, 1, 1)
Vector3.xAxis = newV3(1, 0, 0)
Vector3.yAxis = newV3(0, 1, 0)
Vector3.zAxis = newV3(0, 0, 1)

local Vector2mt = { __type = "Vector2" }
Vector2mt.__index = function(_, k)
	error(tostring(k) .. " is not a valid member of Vector2", 2)
end
Vector2 = {
	new = function(x, y)
		assert(type(x) == "number" and type(y) == "number", "Vector2.new: numbers expected")
		return setmetatable({ X = x, Y = y }, Vector2mt)
	end,
}

------------------------------------------------------------------ CFrame
local CFmt = { __type = "CFrame" }
local IDENT = { 1, 0, 0, 0, 1, 0, 0, 0, 1 }
local function newCF(p, r)
	return setmetatable({ p = p, r = r }, CFmt)
end
local function matmul(A, B)
	local o = {}
	for r = 0, 2 do
		for c = 0, 2 do
			o[r * 3 + c + 1] = A[r * 3 + 1] * B[c + 1] + A[r * 3 + 2] * B[3 + c + 1] + A[r * 3 + 3] * B[6 + c + 1]
		end
	end
	return o
end
local function matvec(R, v)
	return newV3(
		R[1] * v.X + R[2] * v.Y + R[3] * v.Z,
		R[4] * v.X + R[5] * v.Y + R[6] * v.Z,
		R[7] * v.X + R[8] * v.Y + R[9] * v.Z
	)
end
local function transpose(R)
	return { R[1], R[4], R[7], R[2], R[5], R[8], R[3], R[6], R[9] }
end
local function rotX(a)
	local c, s = math.cos(a), math.sin(a)
	return { 1, 0, 0, 0, c, -s, 0, s, c }
end
local function rotY(a)
	local c, s = math.cos(a), math.sin(a)
	return { c, 0, s, 0, 1, 0, -s, 0, c }
end
local function rotZ(a)
	local c, s = math.cos(a), math.sin(a)
	return { c, -s, 0, s, c, 0, 0, 0, 1 }
end

CFrame = {}
function CFrame.lookAt(at, target, up)
	up = up or newV3(0, 1, 0)
	local z = (at - target).Unit
	local x = up:Cross(z).Unit
	local y = z:Cross(x)
	return newCF(at, { x.X, y.X, z.X, x.Y, y.Y, z.Y, x.Z, y.Z, z.Z })
end
function CFrame.new(...)
	local n = select("#", ...)
	local a = { ... }
	if n == 0 then
		return newCF(newV3(0, 0, 0), IDENT)
	elseif n == 1 then
		assert(typeOf(a[1]) == "Vector3", "CFrame.new: Vector3 expected")
		return newCF(a[1], IDENT)
	elseif n == 2 then
		return CFrame.lookAt(a[1], a[2])
	elseif n == 3 then
		for i = 1, 3 do
			assert(type(a[i]) == "number", "CFrame.new: number expected")
		end
		return newCF(newV3(a[1], a[2], a[3]), IDENT)
	elseif n == 12 then
		return newCF(newV3(a[1], a[2], a[3]), { a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12] })
	end
	error("CFrame.new: unsupported argument count " .. n, 2)
end
function CFrame.Angles(rx, ry, rz)
	assert(type(rx) == "number" and type(ry) == "number" and type(rz) == "number", "CFrame.Angles: numbers expected")
	return newCF(newV3(0, 0, 0), matmul(matmul(rotX(rx), rotY(ry)), rotZ(rz)))
end
CFrame.fromEulerAnglesXYZ = CFrame.Angles
local CFmethods = {}
function CFmethods.Inverse(cf)
	local rt = transpose(cf.r)
	return newCF(-matvec(rt, cf.p), rt)
end
function CFmethods.ToWorldSpace(cf, other)
	return cf * other
end
function CFmethods.ToObjectSpace(cf, other)
	return CFmethods.Inverse(cf) * other
end
function CFmethods.PointToWorldSpace(cf, v)
	return cf * v
end
function CFmethods.PointToObjectSpace(cf, v)
	return CFmethods.Inverse(cf) * v
end
function CFmethods.VectorToWorldSpace(cf, v)
	return matvec(cf.r, v)
end
CFmt.__index = function(cf, k)
	if k == "Position" then
		return cf.p
	elseif k == "X" then
		return cf.p.X
	elseif k == "Y" then
		return cf.p.Y
	elseif k == "Z" then
		return cf.p.Z
	elseif k == "LookVector" then
		return newV3(-cf.r[3], -cf.r[6], -cf.r[9])
	elseif k == "RightVector" then
		return newV3(cf.r[1], cf.r[4], cf.r[7])
	elseif k == "UpVector" then
		return newV3(cf.r[2], cf.r[5], cf.r[8])
	end
	local f = CFmethods[k]
	if f then
		return f
	end
	error(tostring(k) .. " is not a valid member of CFrame", 2)
end
CFmt.__mul = function(a, b)
	if typeOf(b) == "CFrame" then
		return newCF(a.p + matvec(a.r, b.p), matmul(a.r, b.r))
	elseif typeOf(b) == "Vector3" then
		return a.p + matvec(a.r, b)
	end
	error("CFrame * " .. typeOf(b) .. " is not supported", 2)
end
CFmt.__add = function(a, b)
	return newCF(a.p + b, a.r)
end
CFmt.__sub = function(a, b)
	return newCF(a.p - b, a.r)
end

------------------------------------------------------------------ Color3 + sequences + ranges
local C3mt = { __type = "Color3" }
local function newC3(r, g, b)
	return setmetatable({ R = r, G = g, B = b }, C3mt)
end
C3mt.__index = function(c, k)
	if k == "Lerp" then
		return function(a, b, t)
			return newC3(a.R + (b.R - a.R) * t, a.G + (b.G - a.G) * t, a.B + (b.B - a.B) * t)
		end
	end
	error(tostring(k) .. " is not a valid member of Color3", 2)
end
C3mt.__eq = function(a, b)
	return a.R == b.R and a.G == b.G and a.B == b.B
end
Color3 = {
	new = function(r, g, b)
		return newC3(r or 0, g or 0, b or 0)
	end,
	fromRGB = function(r, g, b)
		assert(type(r) == "number" and type(g) == "number" and type(b) == "number", "Color3.fromRGB: numbers expected")
		return newC3(r / 255, g / 255, b / 255)
	end,
	fromHSV = function(h, s, v)
		local i = math.floor(h * 6)
		local f = h * 6 - i
		local p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
		i = i % 6
		if i == 0 then
			return newC3(v, t, p)
		elseif i == 1 then
			return newC3(q, v, p)
		elseif i == 2 then
			return newC3(p, v, t)
		elseif i == 3 then
			return newC3(p, q, v)
		elseif i == 4 then
			return newC3(t, p, v)
		end
		return newC3(v, p, q)
	end,
}

local KPmt = { __type = "ColorSequenceKeypoint" }
local NKPmt = { __type = "NumberSequenceKeypoint" }
ColorSequenceKeypoint = {
	new = function(t, c)
		assert(type(t) == "number" and typeOf(c) == "Color3", "ColorSequenceKeypoint.new(number, Color3) expected")
		assert(t >= 0 and t <= 1, "ColorSequenceKeypoint time must be within [0, 1]")
		return setmetatable({ Time = t, Value = c }, KPmt)
	end,
}
NumberSequenceKeypoint = {
	new = function(t, v, e)
		assert(type(t) == "number" and type(v) == "number", "NumberSequenceKeypoint.new(number, number) expected")
		assert(t >= 0 and t <= 1, "NumberSequenceKeypoint time must be within [0, 1]")
		return setmetatable({ Time = t, Value = v, Envelope = e or 0 }, NKPmt)
	end,
}
local function checkKeypoints(name, pts)
	assert(#pts >= 2, name .. ": requires at least 2 keypoints")
	assert(pts[1].Time == 0, name .. ": first time must be 0")
	assert(pts[#pts].Time == 1, name .. ": last time must be 1")
	for i = 2, #pts do
		assert(pts[i].Time >= pts[i - 1].Time, name .. ": keypoints must be in ascending order")
	end
end
local CSmt = { __type = "ColorSequence" }
ColorSequence = {
	new = function(a, b)
		local pts
		if typeOf(a) == "Color3" then
			pts = { ColorSequenceKeypoint.new(0, a), ColorSequenceKeypoint.new(1, b or a) }
		else
			assert(type(a) == "table", "ColorSequence.new: Color3 or table expected")
			pts = copyList(a)
			for _, p in ipairs(pts) do
				assert(typeOf(p) == "ColorSequenceKeypoint", "ColorSequence.new: keypoints expected")
			end
		end
		checkKeypoints("ColorSequence", pts)
		return setmetatable({ Keypoints = pts }, CSmt)
	end,
}
local NSmt = { __type = "NumberSequence" }
NumberSequence = {
	new = function(a, b)
		local pts
		if type(a) == "number" then
			pts = { NumberSequenceKeypoint.new(0, a), NumberSequenceKeypoint.new(1, b or a) }
		else
			assert(type(a) == "table", "NumberSequence.new: number or table expected")
			pts = copyList(a)
			for _, p in ipairs(pts) do
				assert(typeOf(p) == "NumberSequenceKeypoint", "NumberSequence.new: keypoints expected")
			end
		end
		checkKeypoints("NumberSequence", pts)
		return setmetatable({ Keypoints = pts }, NSmt)
	end,
}
local NRmt = { __type = "NumberRange" }
NumberRange = {
	new = function(min, max)
		assert(type(min) == "number", "NumberRange.new: number expected")
		max = max or min
		assert(min <= max, "NumberRange: min must be <= max")
		return setmetatable({ Min = min, Max = max }, NRmt)
	end,
}

------------------------------------------------------------------ Enums
local EnumItemMT = { __type = "EnumItem" }
local function makeEnum(name, items)
	local e = { __name = name }
	for i, itemName in ipairs(items) do
		e[itemName] = setmetatable({ Name = itemName, Value = i - 1, EnumType = e }, EnumItemMT)
	end
	return setmetatable(e, {
		__index = function(_, k)
			error(tostring(k) .. " is not a valid member of Enum." .. name, 2)
		end,
	})
end
Enum = setmetatable({
	Material = makeEnum("Material", {
		"Plastic", "SmoothPlastic", "Neon", "Metal", "DiamondPlate", "Foil", "CorrodedMetal", "Wood", "WoodPlanks",
		"Fabric", "Marble", "Granite", "Slate", "Basalt", "Ice", "Glacier", "Glass", "CrackedLava", "ForceField",
		"Concrete", "Brick", "Sand", "Rock",
	}),
	PartType = makeEnum("PartType", { "Ball", "Block", "Cylinder", "Wedge", "CornerWedge" }),
	SurfaceType = makeEnum("SurfaceType", { "Smooth", "Glue", "Weld", "Studs", "Inlet", "Universal", "Hinge", "Motor", "SteppingMotor", "SmoothNoOutlines" }),
	RaycastFilterType = makeEnum("RaycastFilterType", { "Include", "Exclude" }),
	ActuatorRelativeTo = makeEnum("ActuatorRelativeTo", { "Attachment0", "Attachment1", "World" }),
	ExplosionType = makeEnum("ExplosionType", { "NoCraters", "Craters", "CratersAndDebris" }),
	HighlightDepthMode = makeEnum("HighlightDepthMode", { "AlwaysOnTop", "Occluded" }),
	NormalId = makeEnum("NormalId", { "Right", "Top", "Back", "Left", "Bottom", "Front" }),
}, {
	__index = function(_, k)
		error(tostring(k) .. " is not a valid member of Enum", 2)
	end,
})

------------------------------------------------------------------ Signals
local Signal = {}
Signal.__index = Signal
function Signal.new()
	return setmetatable({ handlers = {}, waiters = {} }, Signal)
end
function Signal:Connect(fn)
	assert(type(fn) == "function", "Connect: function expected")
	local conn = { Connected = true }
	conn.fn = fn
	function conn.Disconnect(c)
		c.Connected = false
	end
	table.insert(self.handlers, conn)
	return conn
end
function Signal:Once(fn)
	local conn
	conn = self:Connect(function(...)
		conn:Disconnect()
		fn(...)
	end)
	return conn
end
function Signal:Wait()
	table.insert(self.waiters, coroutine.running())
	return coroutine.yield()
end
function Signal:Fire(...)
	local waiters = self.waiters
	self.waiters = {}
	for _, co in ipairs(waiters) do
		local ok, err = coroutine.resume(co, ...)
		if not ok then
			table.insert(Mock.errors, tostring(err))
		end
	end
	local live = {}
	for _, conn in ipairs(self.handlers) do
		if conn.Connected then
			table.insert(live, conn)
			task.spawn(conn.fn, ...)
		end
	end
	self.handlers = live
end

------------------------------------------------------------------ scheduler / task library
local Scheduler = { queue = {}, seq = 0 }
local function schedule(co, at, args)
	Scheduler.seq += 1
	table.insert(Scheduler.queue, { co = co, time = at, seq = Scheduler.seq, frame = Mock.frame, args = args or {} })
end
local function resumeThread(co, ...)
	local ok, err = coroutine.resume(co, ...)
	if not ok then
		table.insert(Mock.errors, tostring(err) .. "\n" .. debug.traceback(co))
	end
end
task = {}
function task.spawn(f, ...)
	local co = type(f) == "thread" and f or coroutine.create(f)
	resumeThread(co, ...)
	return co
end
function task.defer(f, ...)
	local co = type(f) == "thread" and f or coroutine.create(f)
	schedule(co, Mock.now, { ... })
	return co
end
function task.delay(t, f, ...)
	local co = type(f) == "thread" and f or coroutine.create(f)
	schedule(co, Mock.now + (t or 0), { ... })
	return co
end
function task.wait(t)
	local co = coroutine.running()
	local started = Mock.now
	schedule(co, Mock.now + (t or 0), {})
	coroutine.yield()
	return Mock.now - started
end
function task.cancel(co)
	for i = #Scheduler.queue, 1, -1 do
		if Scheduler.queue[i].co == co then
			table.remove(Scheduler.queue, i)
		end
	end
end
os.clock = function()
	return Mock.now
end
warn = function(...)
	local parts = {}
	for i = 1, select("#", ...) do
		parts[i] = tostring((select(i, ...)))
	end
	table.insert(Mock.warnings, table.concat(parts, " "))
end

------------------------------------------------------------------ Instance machinery
local STATE = setmetatable({}, { __mode = "k" })
local classes = {}
local InstanceMT = { __type = "Instance" }

local function chainOf(className)
	local chain = {}
	local c = classes[className]
	while c do
		table.insert(chain, c)
		c = c.super and classes[c.super]
	end
	return chain
end
local function lookup(className, field, key)
	for _, c in ipairs(chainOf(className)) do
		local t = c[field]
		if t and t[key] ~= nil then
			return t[key]
		end
	end
	return nil
end
local function hasEvent(className, key)
	for _, c in ipairs(chainOf(className)) do
		if c.events and table.find(c.events, key) then
			return true
		end
	end
	return false
end

local function fullName(inst)
	local parts = {}
	local cur = inst
	while cur do
		table.insert(parts, 1, STATE[cur].props.Name)
		cur = STATE[cur].parent
	end
	return table.concat(parts, ".")
end

local function typeMatches(expected, value)
	local actual = typeOf(value)
	if expected == "number" or expected == "string" or expected == "boolean" then
		return actual == expected
	elseif expected == "Instance?" then
		return value == nil or actual == "Instance"
	elseif string.sub(expected, 1, 5) == "Enum:" then
		return actual == "EnumItem" and value.EnumType.__name == string.sub(expected, 6)
	end
	return actual == expected
end

local function signalOf(inst, name)
	local st = STATE[inst]
	local s = st.signals[name]
	if not s then
		s = Signal.new()
		st.signals[name] = s
	end
	return s
end

local function isCharacter(model)
	return model ~= nil and STATE[model].class == "Model" and model:FindFirstChildOfClass("Humanoid") ~= nil
end

local function setParent(inst, newParent)
	local st = STATE[inst]
	if st.destroyed then
		error("The Parent property of " .. st.props.Name .. " is locked because it has been destroyed", 3)
	end
	if newParent ~= nil and typeOf(newParent) ~= "Instance" then
		error("Unable to assign property Parent. Object expected, got " .. typeOf(newParent), 3)
	end
	local old = st.parent
	if old == newParent then
		return
	end
	local walk = newParent
	while walk do
		if walk == inst then
			error("Attempt to set " .. st.props.Name .. " as its own ancestor", 3)
		end
		walk = STATE[walk].parent
	end
	if old then
		local list = STATE[old].children
		table.remove(list, table.find(list, inst))
		signalOf(old, "ChildRemoved"):Fire(inst)
	end
	st.parent = newParent
	if newParent then
		table.insert(STATE[newParent].children, inst)
		signalOf(newParent, "ChildAdded"):Fire(inst)
		local anc = newParent
		while anc do
			signalOf(anc, "DescendantAdded"):Fire(inst)
			anc = STATE[anc].parent
		end
	end
	signalOf(inst, "AncestryChanged"):Fire(inst, newParent)
	if st.class == "Tool" then
		if old ~= newParent and isCharacter(old) then
			signalOf(inst, "Unequipped"):Fire()
		end
		if isCharacter(newParent) then
			signalOf(inst, "Equipped"):Fire()
		end
	end
end

local function createInstance(className, internal)
	local def = classes[className]
	if not def or (def.noCreate and not internal) then
		error('Unable to create an Instance of type "' .. tostring(className) .. '"', 3)
	end
	local inst = setmetatable({}, InstanceMT)
	local st = { class = className, props = {}, children = {}, attrs = {}, signals = {}, destroyed = false, parent = nil }
	STATE[inst] = st
	local chain = chainOf(className)
	for i = #chain, 1, -1 do
		local props = chain[i].props
		if props then
			for k, spec in pairs(props) do
				st.props[k] = spec[2]
			end
		end
	end
	st.props.Name = className
	return inst
end

InstanceMT.__index = function(self, key)
	local st = STATE[self]
	if key == "ClassName" then
		return st.class
	elseif key == "Parent" then
		return st.parent
	end
	local spec = lookup(st.class, "props", key)
	if spec then
		if spec.get then
			return spec.get(self, st)
		end
		return st.props[key]
	end
	local method = lookup(st.class, "methods", key)
	if method then
		return method
	end
	if hasEvent(st.class, key) then
		return signalOf(self, key)
	end
	for _, child in ipairs(st.children) do
		if STATE[child].props.Name == key then
			return child
		end
	end
	error(tostring(key) .. " is not a valid member of " .. st.class .. ' "' .. fullName(self) .. '"', 2)
end

InstanceMT.__newindex = function(self, key, value)
	local st = STATE[self]
	if key == "Parent" then
		setParent(self, value)
		return
	end
	local spec = lookup(st.class, "props", key)
	if not spec then
		error(tostring(key) .. " is not a valid member of " .. st.class .. ' "' .. fullName(self) .. '"', 2)
	end
	if spec.readonly then
		error("Unable to assign property " .. key .. ". Property is read only", 2)
	end
	if not typeMatches(spec[1], value) then
		error("Unable to assign property " .. key .. ". " .. spec[1] .. " expected, got " .. typeOf(value), 2)
	end
	if spec.set then
		spec.set(self, st, value)
	else
		st.props[key] = value
	end
end
InstanceMT.__tostring = function(self)
	return STATE[self].props.Name
end

local function cloneInstance(inst, map)
	local st = STATE[inst]
	if not st.props.Archivable then
		return nil
	end
	local top = map == nil
	map = map or {}
	local copy = createInstance(st.class)
	map[inst] = copy
	local cst = STATE[copy]
	for k, v in pairs(st.props) do
		cst.props[k] = v
	end
	for k, v in pairs(st.attrs) do
		cst.attrs[k] = v
	end
	for _, child in ipairs(st.children) do
		local c = cloneInstance(child, map)
		if c then
			setParent(c, copy)
		end
	end
	if top then
		-- like Roblox: references to instances inside the cloned tree point at the clones
		for _, c in pairs(map) do
			for k, v in pairs(STATE[c].props) do
				if type(v) == "table" and typeOf(v) == "Instance" and map[v] then
					STATE[c].props[k] = map[v]
				end
			end
		end
	end
	return copy
end

local function descendants(inst, out)
	for _, child in ipairs(STATE[inst].children) do
		table.insert(out, child)
		descendants(child, out)
	end
	return out
end

local function isA(inst, className)
	for _, c in ipairs(chainOf(STATE[inst].class)) do
		if c.name == className then
			return true
		end
	end
	return false
end

local ATTR_OK = { number = true, string = true, boolean = true, Color3 = true, Vector3 = true, CFrame = true }

-- methods every Instance has
local instanceMethods
instanceMethods = {
	Destroy = function(self)
		local st = STATE[self]
		if st.destroyed then
			return
		end
		for _, child in ipairs(copyList(st.children)) do
			child:Destroy()
		end
		signalOf(self, "Destroying"):Fire()
		if st.parent then
			setParent(self, nil)
		end
		st.destroyed = true
	end,
	Clone = function(self)
		return cloneInstance(self)
	end,
	GetChildren = function(self)
		return copyList(STATE[self].children)
	end,
	GetDescendants = function(self)
		return descendants(self, {})
	end,
	FindFirstChild = function(self, name, recursive)
		assert(type(name) == "string", "FindFirstChild: string expected")
		local list = recursive and descendants(self, {}) or STATE[self].children
		for _, child in ipairs(list) do
			if STATE[child].props.Name == name then
				return child
			end
		end
		return nil
	end,
	FindFirstChildOfClass = function(self, className)
		for _, child in ipairs(STATE[self].children) do
			if STATE[child].class == className then
				return child
			end
		end
		return nil
	end,
	FindFirstChildWhichIsA = function(self, className)
		for _, child in ipairs(STATE[self].children) do
			if isA(child, className) then
				return child
			end
		end
		return nil
	end,
	FindFirstAncestorOfClass = function(self, className)
		local cur = STATE[self].parent
		while cur do
			if STATE[cur].class == className then
				return cur
			end
			cur = STATE[cur].parent
		end
		return nil
	end,
	FindFirstAncestor = function(self, name)
		local cur = STATE[self].parent
		while cur do
			if STATE[cur].props.Name == name then
				return cur
			end
			cur = STATE[cur].parent
		end
		return nil
	end,
	IsA = function(self, className)
		return isA(self, className)
	end,
	IsDescendantOf = function(self, other)
		local cur = STATE[self].parent
		while cur do
			if cur == other then
				return true
			end
			cur = STATE[cur].parent
		end
		return false
	end,
	IsAncestorOf = function(self, other)
		return instanceMethods.IsDescendantOf(other, self)
	end,
	WaitForChild = function(self, name, timeout)
		local child = self:FindFirstChild(name)
		if child then
			return child
		end
		local deadline = timeout and (Mock.now + timeout) or nil
		while true do
			task.wait(0.05)
			child = self:FindFirstChild(name)
			if child then
				return child
			end
			if deadline and Mock.now >= deadline then
				return nil
			end
		end
	end,
	GetFullName = function(self)
		return fullName(self)
	end,
	ClearAllChildren = function(self)
		for _, child in ipairs(copyList(STATE[self].children)) do
			child:Destroy()
		end
	end,
	SetAttribute = function(self, name, value)
		assert(type(name) == "string", "SetAttribute: string name expected")
		if value ~= nil and not ATTR_OK[typeOf(value)] then
			error("SetAttribute: unsupported attribute type " .. typeOf(value), 2)
		end
		STATE[self].attrs[name] = value
	end,
	GetAttribute = function(self, name)
		return STATE[self].attrs[name]
	end,
	GetAttributes = function(self)
		local out = {}
		for k, v in pairs(STATE[self].attrs) do
			out[k] = v
		end
		return out
	end,
}

local function def(name, super, d)
	d.name = name
	d.super = super
	classes[name] = d
end

local function P(t, default, extra)
	local spec = { t, default }
	if extra then
		for k, v in pairs(extra) do
			spec[k] = v
		end
	end
	return spec
end

def("Instance", nil, {
	props = { Name = P("string", "Instance"), Archivable = P("boolean", true) },
	methods = instanceMethods,
	events = { "ChildAdded", "ChildRemoved", "DescendantAdded", "Destroying", "AncestryChanged", "Changed" },
	noCreate = true,
})

------------------------------------------------------------------ parts
local function partCFrameSet(self, st, value)
	st.props.CFrame = value
end
def("PVInstance", "Instance", { noCreate = true })
def("BasePart", "PVInstance", {
	props = {
		Anchored = P("boolean", false),
		CanCollide = P("boolean", true),
		CanTouch = P("boolean", true),
		CanQuery = P("boolean", true),
		Massless = P("boolean", false),
		CastShadow = P("boolean", true),
		Color = P("Color3", newC3(0.63, 0.63, 0.63)),
		Material = P("Enum:Material", Enum.Material.Plastic),
		Transparency = P("number", 0),
		Reflectance = P("number", 0),
		Size = P("Vector3", newV3(2, 1, 1)),
		CFrame = P("CFrame", newCF(newV3(0, 0, 0), IDENT), { set = partCFrameSet }),
		Position = P("Vector3", newV3(0, 0, 0), {
			get = function(_, st)
				return st.props.CFrame.p
			end,
			set = function(_, st, v)
				st.props.CFrame = newCF(v, st.props.CFrame.r)
			end,
		}),
		TopSurface = P("Enum:SurfaceType", Enum.SurfaceType.Smooth),
		BottomSurface = P("Enum:SurfaceType", Enum.SurfaceType.Smooth),
		AssemblyLinearVelocity = P("Vector3", newV3(0, 0, 0)),
	},
	methods = {
		GetMass = function()
			return 1
		end,
		SetNetworkOwner = function() end,
	},
	events = { "Touched", "TouchEnded" },
	noCreate = true,
})
def("Part", "BasePart", { props = { Shape = P("Enum:PartType", Enum.PartType.Block) } })
def("WedgePart", "BasePart", {})

------------------------------------------------------------------ misc classes
def("Model", "PVInstance", {})
def("Folder", "Instance", {})
def("Backpack", "Instance", {})
def("Team", "Instance", {})
def("Script", "Instance", { props = { Source = P("string", ""), Disabled = P("boolean", false) } })
def("StringValue", "Instance", { props = { Value = P("string", "") } })
def("ObjectValue", "Instance", { props = { Value = P("Instance?", nil) } })
def("Tool", "Instance", {
	props = {
		Grip = P("CFrame", newCF(newV3(0, 0, 0), IDENT)),
		CanBeDropped = P("boolean", true),
		RequiresHandle = P("boolean", true),
		ToolTip = P("string", ""),
		Enabled = P("boolean", true),
	},
	events = { "Activated", "Deactivated", "Equipped", "Unequipped" },
	methods = {
		Activate = function(self)
			signalOf(self, "Activated"):Fire()
		end,
		Deactivate = function(self)
			signalOf(self, "Deactivated"):Fire()
		end,
	},
})
def("Weld", "Instance", {
	props = {
		Part0 = P("Instance?", nil),
		Part1 = P("Instance?", nil),
		C0 = P("CFrame", newCF(newV3(0, 0, 0), IDENT)),
		C1 = P("CFrame", newCF(newV3(0, 0, 0), IDENT)),
		Enabled = P("boolean", true),
	},
})
def("Attachment", "Instance", {
	props = {
		Position = P("Vector3", newV3(0, 0, 0)),
		CFrame = P("CFrame", newCF(newV3(0, 0, 0), IDENT)),
		Visible = P("boolean", false),
	},
})
def("Sound", "Instance", {
	props = {
		SoundId = P("string", ""),
		Volume = P("number", 0.5),
		TimePosition = P("number", 0),
		PlaybackSpeed = P("number", 1),
		Looped = P("boolean", false),
		Playing = P("boolean", false, { readonly = true }),
	},
	methods = {
		Play = function(self)
			STATE[self].played = (STATE[self].played or 0) + 1
		end,
		Stop = function() end,
	},
})
def("Trail", "Instance", {
	props = {
		Attachment0 = P("Instance?", nil),
		Attachment1 = P("Instance?", nil),
		Color = P("ColorSequence", ColorSequence.new(Color3.new(1, 1, 1))),
		Transparency = P("NumberSequence", NumberSequence.new(0)),
		WidthScale = P("NumberSequence", NumberSequence.new(1)),
		Lifetime = P("number", 2),
		LightEmission = P("number", 0),
		LightInfluence = P("number", 1),
		MinLength = P("number", 0.1),
		MaxLength = P("number", 0),
		FaceCamera = P("boolean", false),
		Enabled = P("boolean", true),
		Texture = P("string", ""),
	},
	methods = { Clear = function() end },
})
def("ParticleEmitter", "Instance", {
	props = {
		Texture = P("string", "rbxasset://textures/particles/sparkles_main.dds"),
		Color = P("ColorSequence", ColorSequence.new(Color3.new(1, 1, 1))),
		Size = P("NumberSequence", NumberSequence.new(1)),
		Transparency = P("NumberSequence", NumberSequence.new(0)),
		Lifetime = P("NumberRange", NumberRange.new(5, 10)),
		Speed = P("NumberRange", NumberRange.new(5, 5)),
		SpreadAngle = P("Vector2", Vector2.new(0, 0)),
		Acceleration = P("Vector3", newV3(0, 0, 0)),
		Drag = P("number", 0),
		Rotation = P("NumberRange", NumberRange.new(0, 0)),
		RotSpeed = P("NumberRange", NumberRange.new(0, 0)),
		LightEmission = P("number", 0),
		LightInfluence = P("number", 1),
		LockedToPart = P("boolean", false),
		Rate = P("number", 20),
		Enabled = P("boolean", true),
		EmissionDirection = P("Enum:NormalId", Enum.NormalId.Top),
	},
	methods = {
		Emit = function(self, count)
			assert(type(count) == "number", "Emit: number expected")
			STATE[self].emitted = (STATE[self].emitted or 0) + count
		end,
		Clear = function() end,
	},
})
def("PointLight", "Instance", {
	props = {
		Brightness = P("number", 1),
		Color = P("Color3", Color3.new(1, 1, 1)),
		Range = P("number", 8),
		Enabled = P("boolean", true),
		Shadows = P("boolean", false),
	},
})
def("Highlight", "Instance", {
	props = {
		OutlineColor = P("Color3", Color3.new(1, 1, 1)),
		FillColor = P("Color3", Color3.new(1, 0, 0)),
		FillTransparency = P("number", 0.5),
		OutlineTransparency = P("number", 0),
		DepthMode = P("Enum:HighlightDepthMode", Enum.HighlightDepthMode.AlwaysOnTop),
		Adornee = P("Instance?", nil),
		Enabled = P("boolean", true),
	},
})
def("Beam", "Instance", {
	props = {
		Attachment0 = P("Instance?", nil),
		Attachment1 = P("Instance?", nil),
		Color = P("ColorSequence", ColorSequence.new(Color3.new(1, 1, 1))),
		Width0 = P("number", 1),
		Width1 = P("number", 1),
		Segments = P("number", 10),
		LightEmission = P("number", 0),
		LightInfluence = P("number", 1),
		FaceCamera = P("boolean", false),
		CurveSize0 = P("number", 0),
		CurveSize1 = P("number", 0),
		Enabled = P("boolean", true),
		Transparency = P("NumberSequence", NumberSequence.new(0)),
	},
})
def("Fire", "Instance", {
	props = {
		Color = P("Color3", Color3.new(1, 0, 0)),
		SecondaryColor = P("Color3", Color3.new(1, 0.5, 0)),
		Size = P("number", 5),
		Heat = P("number", 9),
		Enabled = P("boolean", true),
	},
})
def("Explosion", "Instance", {
	props = {
		BlastPressure = P("number", 500000),
		BlastRadius = P("number", 4),
		DestroyJointRadiusPercent = P("number", 1),
		ExplosionType = P("Enum:ExplosionType", Enum.ExplosionType.Craters),
		Position = P("Vector3", newV3(0, 0, 0)),
	},
	events = { "Hit" },
})
def("LinearVelocity", "Instance", {
	props = {
		Attachment0 = P("Instance?", nil),
		MaxForce = P("number", 0),
		VectorVelocity = P("Vector3", newV3(0, 0, 0)),
		RelativeTo = P("Enum:ActuatorRelativeTo", Enum.ActuatorRelativeTo.World),
		Enabled = P("boolean", true),
	},
})
def("Humanoid", "Instance", {
	props = {
		Health = P("number", 100, {
			set = function(self, st, v)
				local was = st.props.Health
				st.props.Health = math.max(0, math.min(v, st.props.MaxHealth))
				if st.props.Health <= 0 and was > 0 then
					signalOf(self, "Died"):Fire()
				end
			end,
		}),
		MaxHealth = P("number", 100),
		WalkSpeed = P("number", 16),
		JumpPower = P("number", 50),
	},
	events = { "Died" },
	methods = {
		TakeDamage = function(self, amount)
			assert(type(amount) == "number", "TakeDamage: number expected")
			local st = STATE[self]
			local model = st.parent
			if model and model:FindFirstChildOfClass("ForceField") then
				return
			end
			self.Health = self.Health - amount
		end,
	},
})
def("ForceField", "Instance", {})
def("Player", "Instance", {
	props = {
		Character = P("Instance?", nil),
		Team = P("Instance?", nil),
		UserId = P("number", 1),
	},
	events = { "CharacterAdded" },
})

------------------------------------------------------------------ services
def("DataModel", "Instance", {
	noCreate = true,
	methods = {
		GetService = function(self, name)
			local found = self:FindFirstChild(name)
			if found then
				return found
			end
			local def_ = classes[name]
			if not def_ or not def_.service then
				error("'" .. tostring(name) .. "' is not a valid Service name", 2)
			end
			local svc = createInstance(name, true)
			setParent(svc, self)
			return svc
		end,
	},
})
def("Workspace", "Model", {
	service = true,
	noCreate = true,
	methods = {
		GetPartBoundsInBox = function(self, cframe, size, params)
			assert(typeOf(cframe) == "CFrame" and typeOf(size) == "Vector3", "GetPartBoundsInBox: (CFrame, Vector3) expected")
			assert(params == nil or typeOf(params) == "OverlapParams", "GetPartBoundsInBox: OverlapParams expected")
			local result = {}
			for _, inst in ipairs(self:GetDescendants()) do
				if isA(inst, "BasePart") then
					local skip = false
					if params and params.FilterType == Enum.RaycastFilterType.Exclude then
						for _, f in ipairs(params.FilterDescendantsInstances) do
							if inst == f or inst:IsDescendantOf(f) then
								skip = true
							end
						end
					end
					if not skip then
						local d = cframe:PointToObjectSpace(inst.Position)
						local r = math.max(inst.Size.X, inst.Size.Y, inst.Size.Z) / 2
						if math.abs(d.X) <= size.X / 2 + r and math.abs(d.Y) <= size.Y / 2 + r and math.abs(d.Z) <= size.Z / 2 + r then
							table.insert(result, inst)
						end
					end
				end
			end
			return result
		end,
		Raycast = function(self, origin, direction, params)
			if Mock.raycast then
				return Mock.raycast(origin, direction, params)
			end
			return nil
		end,
	},
})
def("Players", "Instance", {
	service = true,
	noCreate = true,
	events = { "PlayerAdded", "PlayerRemoving" },
	methods = {
		GetPlayers = function(self)
			local out = {}
			for _, child in ipairs(STATE[self].children) do
				if STATE[child].class == "Player" then
					table.insert(out, child)
				end
			end
			return out
		end,
		GetPlayerFromCharacter = function(self, model)
			for _, child in ipairs(STATE[self].children) do
				if STATE[child].class == "Player" and child.Character == model then
					return child
				end
			end
			return nil
		end,
	},
})
def("Debris", "Instance", {
	service = true,
	noCreate = true,
	methods = {
		AddItem = function(_, item, lifetime)
			assert(typeOf(item) == "Instance", "AddItem: Instance expected")
			task.delay(lifetime or 10, function()
				item:Destroy()
			end)
		end,
	},
})
def("RunService", "Instance", { service = true, noCreate = true, events = { "Heartbeat", "Stepped" } })
def("StarterPack", "Instance", { service = true, noCreate = true })
def("Selection", "Instance", {
	service = true,
	noCreate = true,
	methods = {
		Set = function(_, list)
			Mock.selection = list
		end,
	},
})

------------------------------------------------------------------ Instance.new / game / workspace
Instance = {
	new = function(className, parent)
		assert(type(className) == "string", "Instance.new: string expected")
		local inst = createInstance(className)
		if parent then
			setParent(inst, parent)
		end
		return inst
	end,
}
game = createInstance("DataModel", true)
STATE[game].props.Name = "Game"
workspace = game:GetService("Workspace")
STATE[workspace].props.Name = "Workspace"

local overlapMT = { __type = "OverlapParams" }
OverlapParams = {
	new = function()
		return setmetatable({ FilterType = Enum.RaycastFilterType.Exclude, FilterDescendantsInstances = {}, MaxParts = 0 }, overlapMT)
	end,
}
local rayMT = { __type = "RaycastParams" }
RaycastParams = {
	new = function()
		return setmetatable({ FilterType = Enum.RaycastFilterType.Exclude, FilterDescendantsInstances = {}, IgnoreWater = false }, rayMT)
	end,
}

------------------------------------------------------------------ test helpers
function Mock.step(dt)
	dt = dt or (1 / 60)
	Mock.frame += 1
	Mock.now += dt
	game:GetService("RunService").Heartbeat:Fire(dt)
	while true do
		local bestIndex, best
		for i, item in ipairs(Scheduler.queue) do
			if item.time <= Mock.now and item.frame < Mock.frame then
				if not best or item.time < best.time or (item.time == best.time and item.seq < best.seq) then
					bestIndex, best = i, item
				end
			end
		end
		if not best then
			break
		end
		table.remove(Scheduler.queue, bestIndex)
		resumeThread(best.co, table.unpack(best.args))
	end
end

function Mock.run(seconds, dt)
	dt = dt or (1 / 60)
	local frames = math.ceil(seconds / dt)
	for _ = 1, frames do
		Mock.step(dt)
	end
end

function Mock.state(inst)
	return STATE[inst]
end

function Mock.pending()
	return #Scheduler.queue
end

-- builds a simple R6-like character with a Humanoid, optionally owned by a Player
function Mock.makeCharacter(name, position)
	local model = Instance.new("Model")
	model.Name = name
	local humanoid = Instance.new("Humanoid")
	humanoid.Parent = model
	local root = Instance.new("Part")
	root.Name = "HumanoidRootPart"
	root.Size = Vector3.new(2, 2, 1)
	root.Position = position or Vector3.new(0, 3, 0)
	root.Parent = model
	local torso = Instance.new("Part")
	torso.Name = "Torso"
	torso.Size = Vector3.new(2, 2, 1)
	torso.Position = position or Vector3.new(0, 3, 0)
	torso.Parent = model
	model.Parent = workspace
	return model, humanoid, root
end

function Mock.makePlayer(name)
	local player = Instance.new("Player")
	player.Name = name
	local backpack = Instance.new("Backpack")
	backpack.Parent = player
	player.Parent = game:GetService("Players")
	game:GetService("Players").PlayerAdded:Fire(player)
	return player, backpack
end

-- gives a player a character and fires CharacterAdded
function Mock.spawnCharacter(player, position)
	local model, humanoid, root = Mock.makeCharacter(player.Name, position)
	player.Character = model
	player.CharacterAdded:Fire(model)
	return model, humanoid, root
end

return Mock
