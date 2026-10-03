/* ==========================================================================
   Sword Forge - engine.js
   The Luau code that ends up inside every generated script. It is kept as
   separate blocks so the generator can include only what a sword needs.

   Tests (tests/run.mjs) execute every block in a real Luau VM against a mock
   Roblox API, so keep this file free of Roblox calls the mock does not know.
   ========================================================================== */
(function (SF) {
  'use strict';

  const E = (SF.ENGINE = {});

  /* ------------------------------------------------------------------ helpers
     Shared by the builder and the combat code. */
  E.helpers = String.raw`local function c3(c)
	return Color3.fromRGB(c[1], c[2], c[3])
end

local function v3(v)
	return Vector3.new(v[1], v[2], v[3])
end

-- looks up an Enum item by name, with a fallback if this Roblox version doesn't have it
local function enumItem(enumType, name, fallback)
	local ok, item = pcall(function()
		return enumType[name]
	end)
	if ok and item ~= nil then
		return item
	end
	return fallback
end

-- sets properties one by one; a property that doesn't exist is skipped instead of breaking the sword
local function setProps(instance, props)
	for key, value in pairs(props) do
		local ok, err = pcall(function()
			instance[key] = value
		end)
		if not ok then
			warn("[SwordForge] could not set " .. instance.ClassName .. "." .. key .. " (" .. tostring(err) .. ")")
		end
	end
end

local function colorSeq(list) -- { {time, {r,g,b}}, ... }
	local points = {}
	for _, key in ipairs(list) do
		table.insert(points, ColorSequenceKeypoint.new(key[1], c3(key[2])))
	end
	return ColorSequence.new(points)
end

local function numSeq(list) -- { {time, value}, ... }
	local points = {}
	for _, key in ipairs(list) do
		table.insert(points, NumberSequenceKeypoint.new(key[1], key[2]))
	end
	return NumberSequence.new(points)
end`;

  /* ------------------------------------------------------------ builder: parts */
  E.builderTop = String.raw`-- one Part (Block, Wedge, Cylinder or Ball) from a CONFIG.Parts entry
local function makePart(d)
	local part
	if d.s == "Wedge" then
		part = Instance.new("WedgePart")
	else
		part = Instance.new("Part")
		if d.s == "Cylinder" then
			part.Shape = Enum.PartType.Cylinder
		elseif d.s == "Ball" then
			part.Shape = Enum.PartType.Ball
		end
	end
	part.Name = d.n
	part.Size = v3(d.sz)
	part.Color = c3(d.c)
	part.Material = enumItem(Enum.Material, d.m, Enum.Material.Plastic)
	part.Transparency = d.t
	part.Reflectance = d.rf
	setProps(part, {
		Anchored = false,
		CanCollide = false,
		CanTouch = false,
		CanQuery = false,
		Massless = true,
		CastShadow = (d.m ~= "Neon" and d.t == 0),
		TopSurface = Enum.SurfaceType.Smooth,
		BottomSurface = Enum.SurfaceType.Smooth,
	})
	return part
end

-- glues "part" to "root"; "offset" is where the part sits relative to the root
local function weldTo(root, part, offset)
	local weld = Instance.new("Weld")
	weld.Name = "SwordWeld"
	weld.Part0 = root
	weld.Part1 = part
	weld.C0 = offset
	weld.Parent = part
end

-- one builder function per kind of effect (glow, particles, trail ...)
local FX = {}`;

  /* ------------------------------------------------------------- effect builders */
  E.fx = {};

  E.fx.glow = String.raw`FX.glow = function(d, ctx)
	local light = Instance.new("PointLight")
	light.Name = "SwordGlow"
	light.Color = c3(d.color)
	light.Brightness = d.brightness
	light.Range = d.range
	light.Shadows = false
	if d.pulse > 0 then
		light:SetAttribute("Pulse", d.pulse)
	end
	light.Parent = ctx.main or ctx.handle
end`;

  E.fx.particles = String.raw`FX.particles = function(d, ctx)
	local parent = ctx.main or ctx.handle
	if d.where == "tip" then
		parent = ctx.tipPoint
	elseif d.where == "hilt" then
		parent = ctx.hiltPoint
	end

	local emitter = Instance.new("ParticleEmitter")
	emitter.Name = d.name
	setProps(emitter, {
		Texture = d.texture,
		Color = colorSeq(d.color),
		Size = numSeq(d.size),
		Transparency = numSeq(d.transparency),
		Lifetime = NumberRange.new(d.lifetime[1], d.lifetime[2]),
		Speed = NumberRange.new(d.speed[1], d.speed[2]),
		SpreadAngle = Vector2.new(d.spread[1], d.spread[2]),
		Acceleration = v3(d.accel),
		Drag = d.drag,
		Rotation = NumberRange.new(d.rot[1], d.rot[2]),
		RotSpeed = NumberRange.new(d.rotSpeed[1], d.rotSpeed[2]),
		LightEmission = d.emission,
		LockedToPart = d.locked,
		Rate = d.rate,
		Enabled = (d.trigger == "idle"),
	})
	emitter:SetAttribute("Trigger", d.trigger)
	if d.count > 0 then
		emitter:SetAttribute("Count", d.count)
	end

	if d.trigger == "hit" then
		-- "hit" effects are templates: they are copied onto whoever you hit
		local folder = ctx.tool:FindFirstChild("HitEffects")
		if not folder then
			folder = Instance.new("Folder")
			folder.Name = "HitEffects"
			folder.Parent = ctx.tool
		end
		emitter.Parent = folder
	else
		emitter.Parent = parent
	end
end`;

  E.fx.trail = String.raw`FX.trail = function(d, ctx)
	local trail = Instance.new("Trail")
	trail.Name = "SwingTrail"
	setProps(trail, {
		Attachment0 = ctx.trailBase,
		Attachment1 = ctx.trailTip,
		Color = colorSeq(d.color),
		Transparency = numSeq(d.transparency),
		WidthScale = numSeq(d.width),
		Lifetime = d.life,
		LightEmission = d.glow,
		LightInfluence = 0,
		MinLength = 0.05,
		FaceCamera = true,
		Enabled = d.always,
	})
	trail:SetAttribute("Trigger", d.always and "idle" or "swing")
	trail.Parent = ctx.handle
end`;

  E.fx.outline = String.raw`FX.outline = function(d, ctx)
	local highlight = Instance.new("Highlight")
	highlight.Name = "SwordOutline"
	setProps(highlight, {
		OutlineColor = c3(d.color),
		FillColor = c3(d.fill),
		FillTransparency = d.fillT,
		OutlineTransparency = d.outlineT,
		DepthMode = enumItem(Enum.HighlightDepthMode, "Occluded", nil),
		Adornee = ctx.tool,
	})
	highlight.Parent = ctx.tool
end`;

  E.fx.arcs = String.raw`FX.arcs = function(d, ctx)
	for i = 1, d.count do
		local sideways = (i - (d.count + 1) / 2) * 0.12
		local startPoint = Instance.new("Attachment")
		startPoint.Name = "ArcStart" .. i
		startPoint.Position = ctx.trailBase.Position + Vector3.new(0, 0, sideways)
		startPoint.Parent = ctx.handle
		local endPoint = Instance.new("Attachment")
		endPoint.Name = "ArcEnd" .. i
		endPoint.Position = ctx.trailTip.Position + Vector3.new(0, 0, sideways)
		endPoint.Parent = ctx.handle

		local beam = Instance.new("Beam")
		beam.Name = "SwordArc" .. i
		setProps(beam, {
			Attachment0 = startPoint,
			Attachment1 = endPoint,
			Color = ColorSequence.new(c3(d.color)),
			Width0 = 0.14,
			Width1 = 0.08,
			Segments = 14,
			LightEmission = 1,
			LightInfluence = 0,
			FaceCamera = true,
			CurveSize0 = 0,
			CurveSize1 = 0,
		})
		beam:SetAttribute("Arc", d.amp)
		beam:SetAttribute("ArcSpeed", d.speed)
		beam.Parent = ctx.handle
	end
end`;

  E.fx.rainbow = String.raw`FX.rainbow = function(d, ctx)
	ctx.tool:SetAttribute("RainbowSpeed", d.speed)
end`;

  /* ------------------------------------------------------------ builder: buildSword */
  E.builderMain = String.raw`-- builds the whole sword and returns the Tool
local function buildSword()
	local tool = Instance.new("Tool")
	tool.Name = CONFIG.Name
	tool.ToolTip = CONFIG.Name
	tool.RequiresHandle = true
	tool.CanBeDropped = false
	-- Grip = how the sword sits in the hand (tilt leans the blade forward)
	tool.Grip = CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(CONFIG.Tilt), 0, 0)

	-- the Handle is an invisible anchor point in the hand; every other part is welded to it
	local handle = Instance.new("Part")
	handle.Name = "Handle"
	handle.Size = Vector3.new(0.4, 0.4, 0.4)
	handle.Transparency = 1
	setProps(handle, {
		Anchored = false,
		CanCollide = false,
		CanTouch = false,
		CanQuery = false,
		Massless = true,
		CastShadow = false,
	})
	handle.Parent = tool

	local ctx = { tool = tool, handle = handle }

	for _, d in ipairs(CONFIG.Parts) do
		local part = makePart(d)
		weldTo(handle, part, CFrame.new(d.p[1], d.p[2], d.p[3]) * CFrame.Angles(math.rad(d.r[1]), math.rad(d.r[2]), math.rad(d.r[3])))
		part.Parent = tool
		if d.main and not ctx.main then
			ctx.main = part
		end
		if d.rb then
			part:SetAttribute("Rainbow", true)
		end
		if d.ap then
			part:SetAttribute("AuraPulse", d.ap)
		end
	end

	-- an invisible box that follows the blade; it decides what a swing hits
	local hitbox = Instance.new("Part")
	hitbox.Name = "Hitbox"
	hitbox.Size = v3(CONFIG.Hitbox.sz)
	hitbox.Transparency = 1
	setProps(hitbox, {
		Anchored = false,
		CanCollide = false,
		CanTouch = false,
		CanQuery = false,
		Massless = true,
		CastShadow = false,
	})
	weldTo(handle, hitbox, CFrame.new(CONFIG.Hitbox.p[1], CONFIG.Hitbox.p[2], CONFIG.Hitbox.p[3]))
	hitbox.Parent = tool

	-- invisible points that effects (trails, particles ...) attach to
	local function attachment(name, position)
		local point = Instance.new("Attachment")
		point.Name = name
		point.Position = v3(position)
		point.Parent = handle
		return point
	end
	ctx.trailBase = attachment("TrailBase", CONFIG.Trail.a)
	ctx.trailTip = attachment("TrailTip", CONFIG.Trail.b)
	ctx.tipPoint = attachment("TipPoint", CONFIG.Tip)
	ctx.hiltPoint = attachment("HiltPoint", CONFIG.Hilt)

	-- sounds (they use sounds that already come with Roblox, so nothing to upload)
	for name, id in pairs(CONFIG.Sounds) do
		if id ~= "" then
			local sound = Instance.new("Sound")
			sound.Name = name .. "Sound"
			sound.SoundId = id
			sound.Volume = 0.8
			sound.Parent = handle
		end
	end

	-- stats become Attributes, so you can also edit them in the Properties window
	for key, value in pairs(STATS) do
		tool:SetAttribute(key, value)
	end

	-- visual effects
	for index, d in ipairs(CONFIG.Effects) do
		local build = FX[d.kind]
		if build then
			local ok, err = pcall(build, d, ctx)
			if not ok then
				warn("[SwordForge] effect #" .. index .. " (" .. d.kind .. ") failed: " .. tostring(err))
			end
		end
	end

	return tool
end`;

  /* ----------------------------------------------------------- combat: top-level */
  E.combatServices = String.raw`local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local RunService = game:GetService("RunService")

local Enchants = {} -- filled in below, one entry per enabled enchantment`;

  E.combatUtil = String.raw`-- pushes a part with a burst of velocity (lunge dash, knockback)
local function push(part, velocity, duration)
	if not part or not part.Parent then
		return
	end
	local anchor = Instance.new("Attachment")
	anchor.Name = "SwordPushPoint"
	anchor.Parent = part
	local mover = Instance.new("LinearVelocity")
	mover.Name = "SwordPush"
	mover.Attachment0 = anchor
	mover.MaxForce = 1000000
	mover.VectorVelocity = velocity
	mover.RelativeTo = Enum.ActuatorRelativeTo.World
	mover.Parent = part
	Debris:AddItem(mover, duration)
	Debris:AddItem(anchor, duration)
end

-- finds the Humanoid (and its character model) that a part belongs to
local function humanoidFromPart(part)
	local model = part:FindFirstAncestorOfClass("Model")
	if model then
		local humanoid = model:FindFirstChildOfClass("Humanoid")
		if humanoid then
			return humanoid, model
		end
	end
	return nil, nil
end`;

  /* ----------------------------------------------------------------- enchantments */
  E.enchantUtil = {};

  E.enchantUtil.dot = String.raw`-- damage over time (burn / poison). "registry" remembers who is already affected
local function damageOverTime(registry, humanoid, dps, duration, makeVisual)
	if registry[humanoid] then
		registry[humanoid] = os.clock() + duration -- already affected: just extend it
		return
	end
	registry[humanoid] = os.clock() + duration
	local visual = makeVisual()
	task.spawn(function()
		while registry[humanoid] and os.clock() < registry[humanoid] and humanoid.Parent and humanoid.Health > 0 do
			task.wait(0.5)
			if humanoid.Health > 0 then
				humanoid:TakeDamage(dps * 0.5)
			end
		end
		registry[humanoid] = nil
		if visual then
			visual:Destroy()
		end
	end)
end`;

  E.enchantUtil.status = String.raw`-- a little cloud of sparkles that follows a target for a while (frost, stun, heal ...)
local function statusEmitter(parent, name, color, seconds, rate)
	local emitter = Instance.new("ParticleEmitter")
	emitter.Name = name
	setProps(emitter, {
		Texture = "rbxasset://textures/particles/sparkles_main.dds",
		Color = ColorSequence.new(c3(color)),
		Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.5), NumberSequenceKeypoint.new(1, 0) }),
		Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(1, 1) }),
		Lifetime = NumberRange.new(0.5, 1),
		Speed = NumberRange.new(2, 5),
		Rate = rate or 30,
		SpreadAngle = Vector2.new(180, 180),
		LightEmission = 1,
	})
	emitter.Parent = parent
	Debris:AddItem(emitter, seconds)
	return emitter
end`;

  E.enchantUtil.movement = String.raw`-- slows / freezes a Humanoid for a while, then puts its WalkSpeed back
local movement = {}
local function changeMovement(humanoid, slowFactor, slowSeconds, stunSeconds)
	local now = os.clock()
	local state = movement[humanoid]
	local isNew = (state == nil)
	if isNew then
		state = { base = humanoid.WalkSpeed, slowUntil = 0, slowFactor = 1, stunUntil = 0 }
		movement[humanoid] = state
	end
	if slowSeconds > 0 then
		state.slowUntil = math.max(state.slowUntil, now + slowSeconds)
		state.slowFactor = slowFactor
	end
	if stunSeconds > 0 then
		state.stunUntil = math.max(state.stunUntil, now + stunSeconds)
	end
	if not isNew then
		return -- the loop below is already running for this Humanoid
	end
	task.spawn(function()
		while humanoid.Parent and humanoid.Health > 0 do
			local t = os.clock()
			if t >= state.slowUntil and t >= state.stunUntil then
				break
			end
			local speed = state.base
			if t < state.slowUntil then
				speed = speed * state.slowFactor
			end
			if t < state.stunUntil then
				speed = 0
			end
			humanoid.WalkSpeed = speed
			task.wait(0.1)
		end
		humanoid.WalkSpeed = state.base
		movement[humanoid] = nil
	end)
end`;

  E.enchants = {};

  E.enchants.burn = String.raw`local burning = {}
Enchants.burn = function(hit)
	local cfg = ENCHANT_CFG.burn
	damageOverTime(burning, hit.targetHumanoid, cfg.dps, cfg.duration, function()
		local fire = Instance.new("Fire")
		fire.Name = "SwordBurn"
		fire.Color = c3(cfg.color)
		fire.SecondaryColor = c3(cfg.color2)
		fire.Size = 7
		fire.Heat = 10
		fire.Parent = hit.targetRoot
		return fire
	end)
end`;

  E.enchants.poison = String.raw`local poisoned = {}
Enchants.poison = function(hit)
	local cfg = ENCHANT_CFG.poison
	damageOverTime(poisoned, hit.targetHumanoid, cfg.dps, cfg.duration, function()
		local fumes = Instance.new("ParticleEmitter")
		fumes.Name = "SwordPoison"
		setProps(fumes, {
			Texture = "rbxasset://textures/particles/smoke_main.dds",
			Color = ColorSequence.new(c3(cfg.color)),
			Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 1.6) }),
			Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.4), NumberSequenceKeypoint.new(1, 1) }),
			Lifetime = NumberRange.new(0.8, 1.4),
			Speed = NumberRange.new(1, 2),
			Rate = 14,
			SpreadAngle = Vector2.new(180, 180),
			LightEmission = 0.3,
		})
		fumes.Parent = hit.targetRoot
		return fumes
	end)
end`;

  E.enchants.freeze = String.raw`Enchants.freeze = function(hit)
	local cfg = ENCHANT_CFG.freeze
	changeMovement(hit.targetHumanoid, 1 - cfg.slow / 100, cfg.duration, 0)
	statusEmitter(hit.targetRoot, "SwordFrost", cfg.color, cfg.duration, 24)
end`;

  E.enchants.stun = String.raw`Enchants.stun = function(hit)
	local cfg = ENCHANT_CFG.stun
	changeMovement(hit.targetHumanoid, 1, 0, cfg.duration)
	statusEmitter(hit.targetRoot, "SwordStun", cfg.color, cfg.duration, 40)
end`;

  E.enchants.lifesteal = String.raw`Enchants.lifesteal = function(hit)
	local cfg = ENCHANT_CFG.lifesteal
	local me = hit.attackerHumanoid
	if me and me.Health > 0 then
		me.Health = math.min(me.MaxHealth, me.Health + hit.damage * cfg.pct / 100)
		if hit.attackerRoot then
			local cloud = statusEmitter(hit.attackerRoot, "SwordHeal", { 255, 80, 110 }, 0.6, 30)
			task.delay(0.3, function()
				cloud.Enabled = false
			end)
		end
	end
end`;

  E.enchants.knockback = String.raw`Enchants.knockback = function(hit)
	local cfg = ENCHANT_CFG.knockback
	local from = hit.attackerRoot
	local away = Vector3.new(0, 0, -1)
	if from then
		local flat = (hit.targetRoot.Position - from.Position) * Vector3.new(1, 0, 1)
		if flat.Magnitude > 0.05 then
			away = flat.Unit
		else
			away = from.CFrame.LookVector
		end
	end
	push(hit.targetRoot, away * cfg.power + Vector3.new(0, cfg.power * 0.3, 0), 0.2)
end`;

  E.enchants.lightning = String.raw`Enchants.lightning = function(hit)
	local cfg = ENCHANT_CFG.lightning
	local ground = hit.targetRoot.Position
	local sky = ground + Vector3.new(0, 45, 0)
	-- a jagged bolt made of glowing segments
	local points = { sky }
	for i = 1, 7 do
		local spot = sky:Lerp(ground, i / 8)
		table.insert(points, spot + Vector3.new(math.random() * 5 - 2.5, 0, math.random() * 5 - 2.5))
	end
	table.insert(points, ground)
	for i = 1, #points - 1 do
		local a, b = points[i], points[i + 1]
		local length = (b - a).Magnitude
		local segment = Instance.new("Part")
		segment.Name = "SwordLightning"
		segment.Size = Vector3.new(0.4, 0.4, length)
		segment.Color = c3(cfg.color)
		segment.Material = Enum.Material.Neon
		segment.CFrame = CFrame.lookAt(a, b) * CFrame.new(0, 0, -length / 2)
		setProps(segment, { Anchored = true, CanCollide = false, CanTouch = false, CanQuery = false, CastShadow = false })
		segment.Parent = workspace
		Debris:AddItem(segment, 0.2)
	end
	local flash = Instance.new("PointLight")
	flash.Color = c3(cfg.color)
	flash.Brightness = 6
	flash.Range = 24
	flash.Parent = hit.targetRoot
	Debris:AddItem(flash, 0.2)
	hit.targetHumanoid:TakeDamage(cfg.damage)
end`;

  E.enchants.explosion = String.raw`Enchants.explosion = function(hit)
	local cfg = ENCHANT_CFG.explosion
	local boom = Instance.new("Explosion")
	boom.BlastPressure = 0 -- looks like a big boom but doesn't throw the world around
	boom.BlastRadius = cfg.size
	boom.DestroyJointRadiusPercent = 0
	boom.ExplosionType = Enum.ExplosionType.NoCraters
	boom.Position = hit.targetRoot.Position
	boom.Parent = workspace
	hit.targetHumanoid:TakeDamage(cfg.damage)
end`;

  /* ----------------------------------------------------------------- animated loops */
  E.loops = String.raw`-- animated effects (pulsing glow, rainbow colors, lightning arcs). Runs only while the sword is held.
local function startLoops(tool, isActive)
	local pulses, auras, colorful, arcs = {}, {}, {}, {}
	local rainbowSpeed = tool:GetAttribute("RainbowSpeed")
	for _, inst in ipairs(tool:GetDescendants()) do
		if inst:IsA("PointLight") then
			if inst:GetAttribute("Pulse") then
				table.insert(pulses, { inst = inst, base = inst.Brightness, speed = inst:GetAttribute("Pulse") })
			end
			if rainbowSpeed then
				table.insert(colorful, { inst = inst, kind = "light", original = inst.Color })
			end
		elseif inst:IsA("BasePart") then
			if inst:GetAttribute("AuraPulse") then
				table.insert(auras, { inst = inst, base = inst.Transparency, speed = inst:GetAttribute("AuraPulse") })
			end
			if rainbowSpeed and inst:GetAttribute("Rainbow") then
				table.insert(colorful, { inst = inst, kind = "part", original = inst.Color })
			end
		elseif inst:IsA("Trail") then
			if rainbowSpeed then
				table.insert(colorful, { inst = inst, kind = "trail", original = inst.Color })
			end
		elseif inst:IsA("Beam") then
			if inst:GetAttribute("Arc") then
				table.insert(arcs, inst)
			end
		end
	end
	if #pulses + #auras + #colorful + #arcs == 0 then
		return
	end

	task.spawn(function()
		local startTime = os.clock()
		while isActive() do
			local t = os.clock() - startTime
			for _, p in ipairs(pulses) do
				p.inst.Brightness = p.base * (0.7 + 0.3 * math.sin(t * p.speed * 2 * math.pi))
			end
			for _, a in ipairs(auras) do
				a.inst.Transparency = math.clamp(a.base + 0.18 * math.sin(t * a.speed * 2 * math.pi), 0, 1)
			end
			if rainbowSpeed then
				local color = Color3.fromHSV((t * rainbowSpeed) % 1, 0.85, 1)
				for _, c in ipairs(colorful) do
					if c.kind == "trail" then
						c.inst.Color = ColorSequence.new(color)
					else
						c.inst.Color = color
					end
				end
			end
			for _, beam in ipairs(arcs) do
				if math.random() < beam:GetAttribute("ArcSpeed") / 20 then
					local wild = beam:GetAttribute("Arc")
					beam.CurveSize0 = (math.random() * 2 - 1) * wild
					beam.CurveSize1 = (math.random() * 2 - 1) * wild
					beam.Enabled = math.random() < 0.85
				end
			end
			task.wait(0.05)
		end
		-- sword put away: restore everything
		for _, p in ipairs(pulses) do
			p.inst.Brightness = p.base
		end
		for _, a in ipairs(auras) do
			a.inst.Transparency = a.base
		end
		for _, c in ipairs(colorful) do
			if c.kind == "trail" then
				c.inst.Color = ColorSequence.new(c.original.Keypoints[1].Value)
			else
				c.inst.Color = c.original
			end
		end
	end)
end`;

  E.loopsStub = String.raw`local function startLoops(tool, isActive) end -- (this sword has no animated effects)`;

  /* ----------------------------------------------------------------- the sword wave */
  E.wave = String.raw`	-- the flying slash wave
	local function fireWave()
		if not root then
			return
		end
		local look = root.CFrame.LookVector
		local origin = root.Position + look * 3 + Vector3.new(0, 0.6, 0)

		local wave = Instance.new("Part")
		wave.Name = "SwordWave"
		wave.Size = Vector3.new(WAVE.size, 0.3, 0.8)
		wave.Color = c3(WAVE.color)
		wave.Material = Enum.Material.Neon
		wave.Transparency = 0.1
		wave.CFrame = CFrame.lookAt(origin, origin + look) * CFrame.Angles(0, 0, math.rad(WAVE.angle))
		setProps(wave, { Anchored = false, CanCollide = false, CanTouch = false, CanQuery = false, CastShadow = false })

		local left = Instance.new("Attachment")
		left.Position = Vector3.new(-WAVE.size / 2, 0, 0)
		left.Parent = wave
		local right = Instance.new("Attachment")
		right.Position = Vector3.new(WAVE.size / 2, 0, 0)
		right.Parent = wave
		local center = Instance.new("Attachment")
		center.Parent = wave

		local trail = Instance.new("Trail")
		setProps(trail, {
			Attachment0 = left,
			Attachment1 = right,
			Color = ColorSequence.new(c3(WAVE.color)),
			Transparency = NumberSequence.new(0.2, 1),
			Lifetime = 0.4,
			LightEmission = 1,
			LightInfluence = 0,
			FaceCamera = false,
		})
		trail.Parent = wave
		local glow = Instance.new("PointLight")
		glow.Color = c3(WAVE.color)
		glow.Brightness = 3
		glow.Range = 14
		glow.Parent = wave

		local mover = Instance.new("LinearVelocity")
		mover.Attachment0 = center
		mover.MaxForce = 10000000
		mover.VectorVelocity = look * WAVE.speed
		mover.RelativeTo = Enum.ActuatorRelativeTo.World
		mover.Parent = wave

		wave.Parent = workspace
		pcall(function()
			wave:SetNetworkOwner(nil)
		end)
		Debris:AddItem(wave, WAVE.range / WAVE.speed + 1)

		task.spawn(function()
			local overlap = OverlapParams.new()
			overlap.FilterType = Enum.RaycastFilterType.Exclude
			overlap.FilterDescendantsInstances = { character, wave }
			local rays = RaycastParams.new()
			rays.FilterType = Enum.RaycastFilterType.Exclude
			rays.FilterDescendantsInstances = { character, wave }
			local alreadyHit = {}
			local travelled = 0
			local lastPosition = wave.Position
			local lastTime = os.clock()
			while wave.Parent and travelled < WAVE.range do
				scan(wave.CFrame, wave.Size + Vector3.new(0, 0, 2), overlap, alreadyHit, WAVE.damage)
				-- stop when the wave smashes into a wall
				local step = wave.Position - lastPosition
				if step.Magnitude > 0.05 then
					local result = workspace:Raycast(lastPosition, step, rays)
					if result and not humanoidFromPart(result.Instance) then
						break
					end
				end
				lastPosition = wave.Position
				local now = os.clock()
				travelled += WAVE.speed * (now - lastTime)
				lastTime = now
				RunService.Heartbeat:Wait()
			end
			wave:Destroy()
		end)
	end`;

  E.waveStub = String.raw`	local function fireWave() end -- (this sword does not fire waves)`;

  /* ----------------------------------------------------------------- combat core */
  E.combatA = (A) => String.raw`-- everything one sword needs to fight; call setupCombat(tool) once per Tool
local function setupCombat(tool)
	local handle = tool:WaitForChild("Handle")
	local hitbox = tool:WaitForChild("Hitbox")
	local baseGrip = tool.Grip

	local character, humanoid, root, player
	local equipped = false
	local session = 0 -- changes on every equip / unequip so old loops know when to stop
	local activeSwings = 0
	local lastSwing = -math.huge
	local comboStep = 0
	local lastComboTime = 0
	local diedConnection

	-- reads a stat; the tool's Attributes win over the defaults in STATS
	local function stat(name)
		local value = tool:GetAttribute(name)
		if value == nil then
			value = STATS[name]
		end
		return value
	end

	local function playSound(name)
		local sound = handle:FindFirstChild(name)
		if sound then
			sound.TimePosition = 0
			sound:Play()
		end
	end
${A ? E.animServer(A) : ''}
	-- effects that react to the sword being used (their "Trigger" attribute says when)
	local swingFx, burstFx, equipFx, hitFx = {}, {}, {}, {}
	for _, inst in ipairs(tool:GetDescendants()) do
		local trigger = inst:GetAttribute("Trigger")
		if trigger == "swing" then
			table.insert(swingFx, inst)
		elseif trigger == "burst" then
			table.insert(burstFx, inst)
		elseif trigger == "equip" then
			table.insert(equipFx, inst)
		elseif trigger == "hit" then
			table.insert(hitFx, inst)
		end
	end

	local function setEnabled(list, on)
		for _, inst in ipairs(list) do
			inst.Enabled = on
		end
	end

	local function emit(list)
		for _, inst in ipairs(list) do
			inst:Emit(inst:GetAttribute("Count") or 12)
		end
	end

	-- puts a burst of the "hit" particles on whoever you just hit
	local function spawnHitFx(targetRoot)
		if #hitFx == 0 then
			return
		end
		local spot = Instance.new("Attachment")
		spot.Name = "SwordHitFx"
		spot.Parent = targetRoot
		for _, template in ipairs(hitFx) do
			local copy = template:Clone()
			copy.Enabled = false
			copy.Parent = spot
			copy:Emit(copy:GetAttribute("Count") or 16)
		end
		Debris:AddItem(spot, 3)
	end

	local function canHurt(model)
		local otherPlayer = Players:GetPlayerFromCharacter(model)
		if otherPlayer and player then
			if otherPlayer == player then
				return false
			end
			if not stat("FriendlyFire") and player.Team ~= nil and otherPlayer.Team == player.Team then
				return false
			end
		end
		return true
	end

	-- one confirmed hit: damage, kill credit, sounds and every enchantment
	local function strike(targetHumanoid, model, hitPart, damage)
		local targetRoot = model:FindFirstChild("HumanoidRootPart") or hitPart
		if player then
			local tag = Instance.new("ObjectValue")
			tag.Name = "creator"
			tag.Value = player
			tag.Parent = targetHumanoid
			Debris:AddItem(tag, 2)
		end
		targetHumanoid:TakeDamage(damage)
		playSound("HitSound")
		spawnHitFx(targetRoot)
		for name, enchant in pairs(Enchants) do
			local ok, err = pcall(enchant, {
				tool = tool,
				attacker = character,
				attackerHumanoid = humanoid,
				attackerRoot = root,
				target = model,
				targetHumanoid = targetHumanoid,
				targetRoot = targetRoot,
				damage = damage,
			})
			if not ok then
				warn("[SwordForge] enchantment '" .. name .. "' failed: " .. tostring(err))
			end
		end
	end

	-- strikes every Humanoid inside a box (each one only once per swing)
	local function scan(cframe, size, params, alreadyHit, damage)
		for _, part in ipairs(workspace:GetPartBoundsInBox(cframe, size, params)) do
			local targetHumanoid, model = humanoidFromPart(part)
			if targetHumanoid and model ~= character and not alreadyHit[targetHumanoid] and targetHumanoid.Health > 0 and canHurt(model) then
				alreadyHit[targetHumanoid] = true
				strike(targetHumanoid, model, part, damage)
			end
		end
	end
`;

  E.combatB = (A) => String.raw`
	-- one swing. kind is "Slash" or "Lunge"
	local function swing(kind, finisher${A && A.swings ? ', moveId' : ''})
		activeSwings += 1
		local damage = stat("Damage")
		local windup, window = 0.1, 0.3
		if kind == "Lunge" then
			damage = damage * stat("FinisherMultiplier")
			windup, window = 0.05, 0.4
		end

${A && A.swings ? `		-- with the animator, the move decides the timing: the blade is live while the sword is actually moving
		local custom = moveId ~= nil
		if custom then
			local total = playMove(moveId)
			local hit = ANIMATION.moves[moveId].hit
			windup = hit[1] * total
			window = math.max(0.15, (hit[2] - hit[1]) * total)
		else
			-- Roblox's default character script plays its slash / lunge animation when it sees this value
			local animation = Instance.new("StringValue")
			animation.Name = "toolanim"
			animation.Value = kind
			animation.Parent = tool
			Debris:AddItem(animation, 1)
		end
` : `		-- Roblox's default character script plays its slash / lunge animation when it sees this value
		local animation = Instance.new("StringValue")
		animation.Name = "toolanim"
		animation.Value = kind
		animation.Parent = tool
		Debris:AddItem(animation, 1)
`}
		playSound(kind == "Lunge" and "LungeSound" or "SwingSound")
		setEnabled(swingFx, true)
		emit(burstFx)

${A && A.swings ? `		if kind == "Lunge" then
			if not custom then
				tool.Grip = baseGrip * CFrame.Angles(math.rad(90), 0, 0) -- point the blade forward
			end
			local dash = stat("LungeDash")
			if dash > 0 and root then
				task.delay(custom and windup * 0.7 or 0, function()
					if equipped and root.Parent then
						push(root, root.CFrame.LookVector * dash, 0.22)
					end
				end)
			end
		end
		if WAVE_MODE == "every" or (WAVE_MODE == "finisher" and finisher) then
			task.delay(custom and windup or 0.12, fireWave)
		end
` : `		if kind == "Lunge" then
			tool.Grip = baseGrip * CFrame.Angles(math.rad(90), 0, 0) -- point the blade forward
			local dash = stat("LungeDash")
			if dash > 0 and root then
				push(root, root.CFrame.LookVector * dash, 0.22)
			end
		end
		if WAVE_MODE == "every" or (WAVE_MODE == "finisher" and finisher) then
			task.delay(0.12, fireWave)
		end
`}
		local params = OverlapParams.new()
		params.FilterType = Enum.RaycastFilterType.Exclude
		params.FilterDescendantsInstances = { character }
		local alreadyHit = {}
		task.wait(windup)
		local startTime = os.clock()
		while equipped and os.clock() - startTime < window do
			scan(hitbox.CFrame, hitbox.Size, params, alreadyHit, damage)
			RunService.Heartbeat:Wait()
		end

		task.wait(0.12) -- let the trail fade out
		activeSwings = math.max(0, activeSwings - 1)
		if activeSwings == 0 then
			setEnabled(swingFx, false)
		end
		if kind == "Lunge"${A && A.swings ? ' and not custom' : ''} then
			task.wait(0.2)
			if equipped then
				tool.Grip = baseGrip
			end
		end
	end

	local function onActivated()
		if not equipped or not humanoid or humanoid.Health <= 0 then
			return
		end
		local now = os.clock()
		if now - lastSwing < stat("Cooldown") then
			return
		end
		lastSwing = now

		local style = stat("SwingStyle")
		local kind = "Slash"
		local finisher = false
${A && A.swings ? `		local step
		if style == "Lunge" then
			kind = "Lunge"
			finisher = true
			animStep += 1
			step = animStep
		elseif style == "Combo" then
			if now - lastComboTime > math.max(1.3, stat("Cooldown") + 0.8) then
				comboStep = 0 -- you waited too long: the combo starts over
			end
			comboStep = comboStep % comboLength + 1
			lastComboTime = now
			step = comboStep
			if comboStep == comboLength then
				kind = "Lunge"
				finisher = true
			end
		else
			animStep += 1
			step = animStep
		end
		local moveId = ANIMATION.swings[(step - 1) % #ANIMATION.swings + 1]
` : `		if style == "Lunge" then
			kind = "Lunge"
			finisher = true
		elseif style == "Combo" then
			if now - lastComboTime > math.max(1.3, stat("Cooldown") + 0.8) then
				comboStep = 0 -- you waited too long: the combo starts over
			end
			comboStep = comboStep % 3 + 1
			lastComboTime = now
			if comboStep == 3 then
				kind = "Lunge"
				finisher = true
			end
		end
`}
		task.spawn(function()
			local ok, err = pcall(swing, kind, finisher${A && A.swings ? ', moveId' : ''})
			if not ok then
				warn("[SwordForge] swing failed: " .. tostring(err))
				activeSwings = 0
				setEnabled(swingFx, false)
			end
		end)
	end

	local function onUnequipped()
		equipped = false
		session += 1
		activeSwings = 0
		setEnabled(swingFx, false)
		tool.Grip = baseGrip${A ? '\n\t\tstopDriver()\n\t\ttool:SetAttribute("SFIdle", "")\n\t\ttool:SetAttribute("SFPlay", "")' : ''}
		if diedConnection then
			diedConnection:Disconnect()
			diedConnection = nil
		end
	end

	tool.Equipped:Connect(function()
		character = tool.Parent
		humanoid = character and character:FindFirstChildOfClass("Humanoid")
		root = character and character:FindFirstChild("HumanoidRootPart")
		player = character and Players:GetPlayerFromCharacter(character)
		if not humanoid then
			return
		end
		equipped = true
		session += 1
		comboStep = 0
		tool.Grip = baseGrip
		playSound("EquipSound")
		emit(equipFx)
${A ? `		tool:SetAttribute("SFIdle", ANIMATION.idle)
		if ANIMATION.equip ~= "" then
			playMove(ANIMATION.equip)
		end
		startDriver()
` : ''}		local token = session
		startLoops(tool, function()
			return equipped and session == token and tool.Parent ~= nil
		end)
		diedConnection = humanoid.Died:Connect(onUnequipped)
	end)
	tool.Unequipped:Connect(onUnequipped)
	tool.Activated:Connect(onActivated)
end`;

  /* ----------------------------------------------------------------- animations */
  // the LocalScript that moves the character (shared by every sword that uses animations)
  E.animMath = String.raw`-- Animations: the moves in ANIMATION are keyframes. While the sword is held, this code turns the wielder's joints
-- (Motor6D.C0, R6 and R15) and the sword's grip every frame. Everything lives in this script, so the animations
-- come with the sword wherever you put it.
local CHANNELS = { "ra", "wr", "la", "to", "he", "rl", "ll" } -- right arm, wrist, left arm, torso, head, right leg, left leg
local rad = math.rad

local function newPose()
	return {
		ra = { 0, 0, 0 }, wr = { 0, 0, 0 }, la = { 0, 0, 0 }, to = { 0, 0, 0 },
		he = { 0, 0, 0 }, rl = { 0, 0, 0 }, ll = { 0, 0, 0 }, dy = 0, dz = 0,
	}
end

local function copyPose(from, into)
	for _, ch in ipairs(CHANNELS) do
		for n = 1, 3 do
			into[ch][n] = from[ch][n]
		end
	end
	into.dy = from.dy
	into.dz = from.dz
end

local function ease(kind, u)
	if kind == "lin" then
		return u
	elseif kind == "in" then
		return u * u
	elseif kind == "out" then
		return 1 - (1 - u) * (1 - u)
	end
	return u * u * (3 - 2 * u)
end

-- a key that does not mention a channel keeps the value it had before
local function prepare(move)
	if move.prepared then
		return
	end
	local current = newPose()
	for _, key in ipairs(move.keys) do
		local pose = newPose()
		for _, ch in ipairs(CHANNELS) do
			local v = key[ch] or current[ch]
			pose[ch] = { v[1], v[2], v[3] }
		end
		pose.dy = key.dy or current.dy
		pose.dz = key.dz or current.dz
		key.pose = pose
		key.e = key.e or "io"
		current = pose
	end
	move.prepared = true
end

-- the body pose of a move at u (0 = start, 1 = end)
local function poseAt(move, u, out)
	local keys = move.keys
	u = math.clamp(u, 0, 1)
	local i = 2
	while i < #keys and u > keys[i].t do
		i += 1
	end
	local a, b = keys[i - 1], keys[i]
	local f = ease(b.e, math.clamp((u - a.t) / math.max(1e-6, b.t - a.t), 0, 1))
	for _, ch in ipairs(CHANNELS) do
		for n = 1, 3 do
			out[ch][n] = a.pose[ch][n] + (b.pose[ch][n] - a.pose[ch][n]) * f
		end
	end
	out.dy = a.pose.dy + (b.pose.dy - a.pose.dy) * f
	out.dz = a.pose.dz + (b.pose.dz - a.pose.dz) * f
end

-- cross-fade; angles take the short way round so a finished spin does not unwind
local function blendPose(a, b, w, out)
	for _, ch in ipairs(CHANNELS) do
		for n = 1, 3 do
			out[ch][n] = a[ch][n] + ((b[ch][n] - a[ch][n] + 180) % 360 - 180) * w
		end
	end
	out.dy = a.dy + (b.dy - a.dy) * w
	out.dz = a.dz + (b.dz - a.dz) * w
end

-- the rig (R6 and R15)
local JOINTS = {
	root = { "RootJoint", "Root" },
	waist = { "Waist" },
	neck = { "Neck" },
	rsh = { "Right Shoulder", "RightShoulder" },
	lsh = { "Left Shoulder", "LeftShoulder" },
	rhip = { "Right Hip", "RightHip" },
	lhip = { "Left Hip", "LeftHip" },
}

local function findRig(character)
	local byName = {}
	for _, d in ipairs(character:GetDescendants()) do
		if d:IsA("Motor6D") then
			byName[d.Name] = d
		end
	end
	local rig = { joints = {}, r6 = byName["RootJoint"] ~= nil }
	for key, names in pairs(JOINTS) do
		for _, name in ipairs(names) do
			local motor = byName[name]
			if motor then
				rig.joints[key] = { motor = motor, c0 = motor.C0 }
				break
			end
		end
	end
	return rig
end

local function angles(v)
	return CFrame.Angles(rad(v[1]), rad(v[2]), rad(v[3]))
end

-- turns a joint about its own pivot (in the parent part's frame) and slides it by "move"
local function offset(joint, rotation, move)
	if joint then
		local pivot = joint.c0.Position
		joint.motor.C0 = CFrame.new(pivot + move) * rotation * (joint.c0 - pivot)
	end
end

local NONE = Vector3.new(0, 0, 0)
local SAME = CFrame.new()

local function applyPose(rig, pose)
	local j = rig.joints
	local torso = angles(pose.to)
	local body = Vector3.new(0, pose.dy, pose.dz)
	if rig.r6 then
		-- R6 has no waist: turn the whole torso, and let the hips cancel it so the legs stay put
		offset(j.root, torso, body)
		local undo = torso:Inverse()
		offset(j.rhip, undo * angles(pose.rl), NONE)
		offset(j.lhip, undo * angles(pose.ll), NONE)
	else
		offset(j.root, SAME, body)
		offset(j.waist, torso, NONE)
		offset(j.rhip, angles(pose.rl), NONE)
		offset(j.lhip, angles(pose.ll), NONE)
	end
	offset(j.rsh, angles(pose.ra), NONE)
	offset(j.lsh, angles(pose.la), NONE)
	offset(j.neck, angles(pose.he), NONE)
end

local function applyGrip(rig, character, pose)
	local grip = rig.grip
	if not grip or grip.weld.Parent == nil then
		local weld = character:FindFirstChild("RightGrip", true)
		grip = weld and { weld = weld, c0 = weld.C0 } or nil
		rig.grip = grip
	end
	if grip then
		grip.weld.C0 = grip.c0 * angles(pose.wr)
	end
end

local function restore(rig)
	for _, joint in pairs(rig.joints) do
		joint.motor.C0 = joint.c0
	end
	if rig.grip and rig.grip.weld.Parent then
		rig.grip.weld.C0 = rig.grip.c0
	end
	rig.grip = nil
end

-- ---- driving one wielder: blends between the move that is playing and the idle stance ----
local zeroPose = newPose()
local scratchPose = newPose()

local function newDriver(character)
	return {
		rig = findRig(character), pose = newPose(), from = newPose(), blendTime = 1, blendLength = 0.1,
		playKey = "", move = nil, start = 0, speed = 1,
	}
end

local function startBlend(s, length)
	copyPose(s.pose, s.from)
	s.blendTime = 0
	s.blendLength = length
end

-- one frame: reads what the sword says is playing (attributes SFPlay / SFIdle) and turns the joints
local function stepDriver(s, character, tool, dt)
	local play = tool:GetAttribute("SFPlay") or ""
	if play ~= s.playKey then
		s.playKey = play
		local id, start, speed = string.match(play, "^([^|]*)|([^|]*)|([^|]*)")
		local move = id and ANIMATION.moves[id]
		if move then
			startBlend(s, move.hit and 0.08 or 0.12)
			s.move, s.start, s.speed = move, tonumber(start) or 0, tonumber(speed) or 1
		else
			s.move = nil
		end
	end

	local target = scratchPose
	local found = false
	if s.move then
		local u = (workspace:GetServerTimeNow() - s.start) * s.speed / s.move.dur
		if u >= 1 then
			s.move = nil
			startBlend(s, 0.18)
		else
			poseAt(s.move, u, target)
			found = true
		end
	end
	if not found then
		local idle = ANIMATION.moves[tool:GetAttribute("SFIdle") or ""]
		if idle then
			poseAt(idle, (os.clock() / idle.dur) % 1, target)
		else
			copyPose(zeroPose, target)
		end
	end

	if s.blendTime < s.blendLength then
		s.blendTime += dt
		local w = math.min(1, s.blendTime / s.blendLength)
		blendPose(s.from, target, w * w * (3 - 2 * w), s.pose)
	else
		copyPose(target, s.pose)
	end
	applyPose(s.rig, s.pose)
	applyGrip(s.rig, character, s.pose)
end

for _, move in pairs(ANIMATION.moves) do
	prepare(move)
end`;

  // inside setupCombat
  E.animServer = (A) => String.raw`

	-- ---- animations ---------------------------------------------------------------------
	local moveCounter = 0
${A.swings ? `	local animStep = 0
	local comboLength = math.max(#ANIMATION.swings, 3)
` : ''}
	-- turns the wielder's joints while the sword is held
	local driverState, driverConnection
	local function stopDriver()
		if driverConnection then
			driverConnection:Disconnect()
			driverConnection = nil
		end
		if driverState then
			restore(driverState.rig)
			driverState = nil
		end
	end
	local function startDriver()
		stopDriver()
		local state = newDriver(character)
		driverState = state
		driverConnection = RunService.Heartbeat:Connect(function(dt)
			local ok, err = pcall(stepDriver, state, character, tool, dt)
			if not ok then
				warn("[SwordForge] animation stopped: " .. tostring(err))
				stopDriver()
			end
		end)
	end

	-- starts a move and returns how long it lasts (seconds)
	local function playMove(id)
		local data = ANIMATION.moves[id]
		if not data then
			return 0
		end
		moveCounter += 1
		tool:SetAttribute("SFPlay", string.format("%s|%.3f|%.3f|%d", id, workspace:GetServerTimeNow(), ANIMATION.speed, moveCounter))
		return data.dur / ANIMATION.speed
	end
`;

  /* ----------------------------------------------------------------- delivery (runtime mode) */
  E.delivery = String.raw`-- gives every player a fresh copy of the sword each time they spawn
local function giveSword(player)
	local backpack = player:FindFirstChildOfClass("Backpack") or player:WaitForChild("Backpack", 10)
	if not backpack then
		return
	end
	local character = player.Character
	if backpack:FindFirstChild(CONFIG.Name) or (character and character:FindFirstChild(CONFIG.Name)) then
		return
	end
	local tool = buildSword()
	setupCombat(tool)
	tool.Parent = backpack
end

local function onPlayerAdded(player)
	player.CharacterAdded:Connect(function()
		task.wait(0.2)
		giveSword(player)
	end)
	if player.Character then
		giveSword(player)
	end
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(onPlayerAdded, player)
end`;

  /* ----------------------------------------------------------------- delivery (command bar mode) */
  E.install = String.raw`-- build the sword and drop it into StarterPack
local StarterPack = game:GetService("StarterPack")
local old = StarterPack:FindFirstChild(CONFIG.Name)
if old then
	old:Destroy() -- replace an older version
end

local tool = buildSword()
local combatScript = Instance.new("Script")
combatScript.Name = "SwordScript"
combatScript.Source = COMBAT_SOURCE
combatScript.Parent = tool
tool.Parent = StarterPack

pcall(function()
	game:GetService("Selection"):Set({ tool })
end)
print("[SwordForge] Built '" .. tool.Name .. "' in StarterPack. Press Play to try it!")`;
})((globalThis.SF = globalThis.SF || {}));
