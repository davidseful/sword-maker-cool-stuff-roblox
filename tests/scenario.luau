--!nonstrict
-- Plays a short "game" against the generated sword script and reports what happened.
-- Runs after the generated script. EXPECT (set by tests/run.mjs) describes what to expect.

local StarterPack = game:GetService("StarterPack")
local Mock = _G.Mock

local function check(cond, message)
	__report(cond and true or false, message)
end

local function descendantsOfClass(inst, className)
	local out = {}
	for _, d in ipairs(inst:GetDescendants()) do
		if d:IsA(className) then
			table.insert(out, d)
		end
	end
	return out
end

local function has(list, value)
	for _, v in ipairs(list) do
		if v == value then
			return true
		end
	end
	return false
end

local player, backpack = Mock.makePlayer("Tester")
local character, humanoid, root = Mock.spawnCharacter(player, Vector3.new(0, 3, 0))
humanoid.MaxHealth = 1000000
humanoid.Health = 1000000
local ANIM = EXPECT.anim
local rig6 = ANIM and Mock.makeRig(character, "R6") or nil
local orig6 = {}
if rig6 then
	for key, joint in pairs(rig6) do
		orig6[key] = joint.C0
	end
end
Mock.run(0.6)

------------------------------------------------------------------ get the tool
local tool
if EXPECT.mode == "commandbar" then
	local template = StarterPack:FindFirstChild(EXPECT.name)
	check(template ~= nil, "the sword was built into StarterPack")
	if not template then
		return
	end
	check(#Mock.selection == 1, "the new tool got selected in the Explorer")
	local scripts = descendantsOfClass(template, "Script")
	check(#scripts == 1, "the tool contains exactly one Script")
	if #scripts ~= 1 then
		return
	end
	-- what Studio does when a player spawns: clone the tool into the Backpack, its Script starts
	tool = template:Clone()
	tool.Parent = backpack
	local cloned = descendantsOfClass(tool, "Script")[1]
	__runSource(cloned.Source, cloned)
	Mock.run(0.1)
else
	tool = backpack:FindFirstChild(EXPECT.name)
	check(tool ~= nil, "the sword was given to the player's Backpack")
	if not tool then
		return
	end
end

------------------------------------------------------------------ animations: the LocalScript inside the Tool
local function startAnimator(t)
	local animator = t:FindFirstChild("SwordForgeAnimator")
	check((animator ~= nil) == (ANIM ~= nil and EXPECT.clientAnimator), "the Tool carries SwordForgeAnimator exactly when expected")
	if animator then
		check(animator:IsA("LocalScript") and #animator.Source > 2000, "the animator is a LocalScript with its source")
		-- what Roblox does for a LocalScript in a Tool that is in your Backpack: it runs
		__runSource(animator.Source, animator)
	end
end
if ANIM then
	startAnimator(tool)
	Mock.run(0.1)
end

------------------------------------------------------------------ structure
local handle = tool:FindFirstChild("Handle")
local hitbox = tool:FindFirstChild("Hitbox")
check(handle ~= nil and handle:IsA("BasePart"), "Handle exists")
check(hitbox ~= nil and hitbox:IsA("BasePart"), "Hitbox exists")
check(tool.RequiresHandle == true and tool.CanBeDropped == false, "Tool settings")

local weldCount, partCount = 0, 0
for _, d in ipairs(tool:GetDescendants()) do
	if d:IsA("Weld") then
		weldCount += 1
		check(d.Part0 == handle and d.Part1 ~= nil and d.Part1.Parent == tool, "every weld joins the Handle to a part")
	elseif d:IsA("BasePart") and d ~= handle and d ~= hitbox then
		partCount += 1
		check(d.Massless and not d.CanCollide and not d.Anchored, "sword parts are massless, non-colliding, unanchored")
	end
end
check(partCount == EXPECT.partCount, "part count " .. partCount .. " == " .. EXPECT.partCount)
check(weldCount == EXPECT.partCount + 1, "one weld per part plus the hitbox")
check(tool:GetAttribute("Damage") == EXPECT.damage, "Damage attribute is set")
check(tool:GetAttribute("SwingStyle") == EXPECT.swing, "SwingStyle attribute is set")
check(tool:GetAttribute("SFPlay") == nil or EXPECT.anim ~= nil, "only animated swords carry animation attributes")

local trails = descendantsOfClass(tool, "Trail")
local swingTrails, alwaysTrails = 0, 0
for _, t in ipairs(trails) do
	check(t.Attachment0 ~= nil and t.Attachment1 ~= nil, "trail has both attachments")
	if t:GetAttribute("Trigger") == "swing" then
		swingTrails += 1
		check(t.Enabled == false, "swing trail starts disabled")
	else
		alwaysTrails += 1
	end
end
check(swingTrails == EXPECT.swingTrails, "swing trails: " .. swingTrails)
check(alwaysTrails == EXPECT.alwaysTrails, "always-on trails: " .. alwaysTrails)

local emitters = descendantsOfClass(tool, "ParticleEmitter")
local counts = { idle = 0, swing = 0, burst = 0, hit = 0, equip = 0 }
for _, e in ipairs(emitters) do
	local trig = e:GetAttribute("Trigger")
	counts[trig] += 1
	if trig == "idle" then
		check(e.Enabled and e.Rate > 0, "idle emitter is enabled")
	else
		check(not e.Enabled, trig .. " emitter starts disabled")
	end
end
check(counts.idle == EXPECT.idleEmitters and counts.swing == EXPECT.swingEmitters and counts.burst == EXPECT.burstEmitters
	and counts.hit == EXPECT.hitEmitters and counts.equip == EXPECT.equipEmitters, "emitter counts per trigger")

local lights = descendantsOfClass(tool, "PointLight")
check(#lights == EXPECT.lights, "glow lights: " .. #lights)
check(#descendantsOfClass(tool, "Beam") == EXPECT.arcs, "lightning arc beams")
check(#descendantsOfClass(tool, "Highlight") == EXPECT.outlines, "outlines")

------------------------------------------------------------------ equip
local equipBefore = 0
for _, e in ipairs(emitters) do
	if e:GetAttribute("Trigger") == "equip" then
		equipBefore += Mock.state(e).emitted or 0
	end
end
tool.Parent = character
Mock.run(0.3)
check(tool.Parent == character, "tool is equipped")
if ANIM then
	check(tool:GetAttribute("SFIdle") == ANIM.idle, "SFIdle is the idle stance (" .. tostring(tool:GetAttribute("SFIdle")) .. ")")
	local play = tool:GetAttribute("SFPlay") or ""
	if ANIM.equip ~= "" then
		check(string.match(play, "^" .. ANIM.equip .. "|") ~= nil, "the equip flourish started (" .. play .. ")")
	else
		check(play == "", "no equip flourish")
	end
end
local equipAfter = 0
for _, e in ipairs(emitters) do
	if e:GetAttribute("Trigger") == "equip" then
		equipAfter += Mock.state(e).emitted or 0
	end
end
check((equipAfter > equipBefore) == (EXPECT.equipEmitters > 0), "equip burst fired exactly when expected")
if EXPECT.equipSound then
	check(Mock.state(handle:FindFirstChild("EquipSound")).played == 1, "equip sound played")
end

------------------------------------------------------------------ melee swing
local dummy, dummyHum, dummyRoot = Mock.makeCharacter("Dummy", Vector3.new(0, 3, -6))
dummyHum.MaxHealth = 1000000
dummyHum.Health = 1000000
hitbox.CFrame = CFrame.new(dummyRoot.Position)
local walkBefore = dummyHum.WalkSpeed
humanoid.Health = 500000 -- so life steal has room to heal

local function hurt()
	return 1000000 - dummyHum.Health
end

tool:Activate()
Mock.run(EXPECT.hitWait)
-- the hit lands ~0.1s after the click (or when the move reaches its hit window); its effects are still alive now
for _, t in ipairs(trails) do
	if t:GetAttribute("Trigger") == "swing" then
		check(t.Enabled == true, "swing trail is enabled during the swing")
	end
end
for _, e in ipairs(emitters) do
	if e:GetAttribute("Trigger") == "swing" then
		check(e.Enabled == true, "swing emitter is enabled during the swing")
	end
end
local anim = tool:FindFirstChild("toolanim")
if EXPECT.customSwings then
	check(anim == nil, "an animated swing does not use the default toolanim")
	local play = tool:GetAttribute("SFPlay") or ""
	check(string.match(play, "^" .. ANIM.swings[1] .. "|") ~= nil, "the first swing plays " .. ANIM.swings[1] .. " (" .. play .. ")")
else
	check(anim ~= nil and anim.Value == (EXPECT.swing == "Lunge" and "Lunge" or "Slash"), "toolanim value for the first swing")
end

local firstDamage = EXPECT.firstDamage
check(hurt() >= firstDamage - 0.001, "first swing damaged the dummy by at least " .. firstDamage .. " (was " .. hurt() .. ")")
if not EXPECT.hasExtraDamage then
	check(math.abs(hurt() - firstDamage) < 0.001, "damage is exactly " .. firstDamage .. " (was " .. hurt() .. ")")
end

local e = EXPECT.enchants
if e.burn then
	check(dummyRoot:FindFirstChildOfClass("Fire") ~= nil, "burn: the target is on fire")
end
if e.poison then
	check(dummyRoot:FindFirstChild("SwordPoison") ~= nil, "poison: fumes on the target")
end
if e.freeze then
	check(dummyHum.WalkSpeed < walkBefore, "freeze: target is slowed (" .. dummyHum.WalkSpeed .. ")")
end
if e.stun then
	check(dummyHum.WalkSpeed == 0, "stun: target can't move")
end
if e.lifesteal then
	check(humanoid.Health > 500000, "life steal healed the wielder")
end
if e.knockback then
	local mover = dummyRoot:FindFirstChild("SwordPush")
	check(mover ~= nil, "knockback: the target is being pushed")
	check(mover and mover.VectorVelocity.Z < 0 and mover.VectorVelocity.Y > 0, "knockback pushes away from the wielder and up a bit")
end
if e.lightning then
	local bolts = 0
	for _, c in ipairs(workspace:GetChildren()) do
		if c.Name == "SwordLightning" then
			bolts += 1
		end
	end
	check(bolts >= 5, "lightning: a bolt of " .. bolts .. " segments")
end
if e.explosion then
	local boom
	for _, c in ipairs(workspace:GetChildren()) do
		if c:IsA("Explosion") then
			boom = c
		end
	end
	check(boom ~= nil and boom.BlastPressure == 0 and boom.DestroyJointRadiusPercent == 0, "explosion is visual only")
end

local hitEmitted = 0
local spot = dummyRoot:FindFirstChild("SwordHitFx")
if spot then
	for _, c in ipairs(spot:GetChildren()) do
		hitEmitted += Mock.state(c).emitted or 0
	end
end
check((hitEmitted > 0) == (EXPECT.hitEmitters > 0), "hit particles burst exactly when expected")

local burstEmitted = 0
for _, em in ipairs(emitters) do
	if em:GetAttribute("Trigger") == "burst" then
		burstEmitted += Mock.state(em).emitted or 0
	end
end
check((burstEmitted > 0) == (EXPECT.burstEmitters > 0), "swing burst fired exactly when expected")
if EXPECT.swingSound then
	local sound = handle:FindFirstChild(EXPECT.swing == "Lunge" and "LungeSound" or "SwingSound")
	check(sound ~= nil and Mock.state(sound).played == 1, "swing sound played once")
end

Mock.run(EXPECT.swingTail) -- the swing is over
local dmgAfterSwing = hurt()
check(dmgAfterSwing < firstDamage + EXPECT.maxExtra, "no double hits in one swing (" .. dmgAfterSwing .. ")")
check(humanoid.Health >= 500000 and (EXPECT.lifesteal or humanoid.Health == 500000), "the wielder is not hurt by their own sword")
local bolts = 0
for _, c in ipairs(workspace:GetChildren()) do
	if c.Name == "SwordLightning" then
		bolts += 1
	end
end
check(bolts == 0, "lightning bolts are gone after a moment")

-- swing effects switch off again
Mock.run(0.5)
for _, t in ipairs(trails) do
	if t:GetAttribute("Trigger") == "swing" then
		check(t.Enabled == false, "swing trail switched off after the swing")
	end
end

-- status effects wear off
Mock.run(14)
if e.burn then
	check(dummyRoot:FindFirstChildOfClass("Fire") == nil, "burn: the fire goes out")
end
if e.freeze or e.stun then
	check(dummyHum.WalkSpeed == walkBefore, "movement speed is restored (" .. dummyHum.WalkSpeed .. ")")
end
if e.knockback then
	check(dummyRoot:FindFirstChild("SwordPush") == nil, "knockback push ends")
end

------------------------------------------------------------------ combo + lunge pose
local baseLook = tool.Grip.LookVector
local gap = math.max(EXPECT.cooldown, 0.1) + 0.7
dummyHum.Health = 1000000
local playsSeen = {}
local function notePlay()
	local play = tool:GetAttribute("SFPlay") or ""
	table.insert(playsSeen, (string.match(play, "^([^|]*)|") or ""))
end
tool:Activate() -- swing 1 of a fresh combo (more than the reset time has passed)
Mock.run(0.05)
notePlay()
Mock.run(gap)
if EXPECT.swing == "Combo" then
	for step = 2, EXPECT.comboLength - 1 do
		tool:Activate()
		Mock.run(0.05)
		notePlay()
		Mock.run(gap)
	end
	local before = hurt()
	tool:Activate() -- the last hit of the combo: the finisher (lunge)
	Mock.run(0.05)
	notePlay()
	Mock.run(EXPECT.finisherWait)
	if EXPECT.customSwings then
		check((tool.Grip.LookVector - baseLook).Magnitude < 1e-6, "an animated finisher leaves the grip alone (the move turns the wrist)")
	else
		check(math.abs(tool.Grip.LookVector.Y - math.cos(math.rad(EXPECT.tilt))) < 1e-4, "finisher points the blade forward (lunge pose)")
		local anim3 = tool:FindFirstChild("toolanim")
		check(anim3 ~= nil and anim3.Value == "Lunge", "toolanim is Lunge on the 3rd swing")
	end
	Mock.run(EXPECT.swingTail + 1.5)
	check((tool.Grip.LookVector - baseLook).Magnitude < 1e-6, "grip is restored after the lunge")
	check(hurt() - before >= EXPECT.damage * EXPECT.finisher - 0.001, "finisher hits harder")
elseif EXPECT.swing == "Lunge" then
	check(true, "lunge style")
else
	Mock.run(0.5)
	check((tool.Grip.LookVector - baseLook).Magnitude < 1e-6, "slash style never changes the grip")
end
if EXPECT.customSwings and EXPECT.swing == "Combo" then
	local ok = #playsSeen == EXPECT.comboLength
	for i, id in ipairs(playsSeen) do
		if id ~= ANIM.swings[(i - 1) % #ANIM.swings + 1] then
			ok = false
		end
	end
	check(ok, "the combo plays the moves in order (" .. table.concat(playsSeen, ",") .. ")")
end

------------------------------------------------------------------ sword wave
if EXPECT.wave ~= "off" then
	-- move the melee hitbox far away and put a fresh dummy right where the wave appears
	hitbox.CFrame = CFrame.new(0, 500, 0)
	dummy:Destroy()
	local dummy2, dummyHum2, dummyRoot2 = Mock.makeCharacter("Dummy2", Vector3.new(0, 3.6, -3))
	dummyHum2.MaxHealth = 1000000
	dummyHum2.Health = 1000000
	-- reset the combo
	Mock.run(5)
	local function waveCount()
		local n = 0
		for _, c in ipairs(workspace:GetChildren()) do
			if c.Name == "SwordWave" then
				n += 1
			end
		end
		return n
	end
	local fired = false
	local wave
	for i = 1, EXPECT.comboLength do
		tool:Activate()
		local frames = (EXPECT.wave == "finisher" and i < EXPECT.comboLength and EXPECT.swing == "Combo") and 24 or EXPECT.waveWatch
		for _ = 1, frames do -- watch every frame: a fast wave can be gone within a tenth of a second
			Mock.step()
			if not wave and waveCount() > 0 then
				fired = true
				for _, c in ipairs(workspace:GetChildren()) do
					if c.Name == "SwordWave" then
						wave = c
					end
				end
				if EXPECT.wave == "finisher" then
					check(i == EXPECT.comboLength or EXPECT.swing == "Lunge", "the wave only comes with the finisher (swing " .. i .. ")")
				end
				-- the structure is checked the moment it appears
				check(wave:FindFirstChildOfClass("LinearVelocity") ~= nil, "the wave flies with a LinearVelocity")
				check(wave:FindFirstChildOfClass("Trail") ~= nil, "the wave leaves a trail")
			end
		end
		if fired then
			break
		end
		Mock.run(math.max(0.05, gap - frames / 60)) -- keep the swings close enough to chain a combo
	end
	check(fired == EXPECT.waveFires, "a sword wave is fired exactly when expected (fired=" .. tostring(fired) .. ")")
	if fired and EXPECT.waveFires then
		check(1000000 - dummyHum2.Health >= EXPECT.waveDamage - 0.001, "the wave hurt the target in its path (" .. (1000000 - dummyHum2.Health) .. ")")
		Mock.run(EXPECT.waveRange / EXPECT.waveSpeed + 2.5)
		check(waveCount() == 0, "the wave disappears after its range")
	end
end

------------------------------------------------------------------ the animator turns the joints (R6 and R15), checked against the JS pose math
if ANIM then
	local function mat(t)
		return CFrame.new(0, 0, 0, t[1], t[2], t[3], t[4], t[5], t[6], t[7], t[8], t[9])
	end
	local function rotOnly(cf)
		return cf - cf.Position
	end
	local function near(a, b)
		if (a.Position - b.Position).Magnitude > 0.02 then
			return false
		end
		for i = 1, 9 do
			if math.abs(a.r[i] - b.r[i]) > 0.02 then
				return false
			end
		end
		return true
	end
	local function expectedFor(kind, orig, m, dy, dz)
		local at = function(key, extra)
			return CFrame.new(orig[key].Position + (extra or Vector3.new(0, 0, 0)))
		end
		local out = {}
		if kind == "R6" then
			out.root = at("root", Vector3.new(0, dy, dz)) * mat(m.to) * rotOnly(orig.root)
			out.rhip = at("rhip") * mat(m.to):Inverse() * mat(m.rl) * rotOnly(orig.rhip)
			out.lhip = at("lhip") * mat(m.to):Inverse() * mat(m.ll) * rotOnly(orig.lhip)
		else
			out.root = at("root", Vector3.new(0, dy, dz)) * rotOnly(orig.root)
			out.waist = at("waist") * mat(m.to) * rotOnly(orig.waist)
			out.rhip = at("rhip") * mat(m.rl) * rotOnly(orig.rhip)
			out.lhip = at("lhip") * mat(m.ll) * rotOnly(orig.lhip)
		end
		out.neck = at("neck") * mat(m.he) * rotOnly(orig.neck)
		out.rsh = at("rsh") * mat(m.ra) * rotOnly(orig.rsh)
		out.lsh = at("lsh") * mat(m.la) * rotOnly(orig.lsh)
		out.grip = orig.grip * mat(m.wr)
		return out
	end

	-- a second player with an R15 body and a sword of their own
	local player2, backpack2 = Mock.makePlayer("Tester15")
	local character15, humanoid15 = Mock.spawnCharacter(player2, Vector3.new(30, 3, 0))
	humanoid15.MaxHealth = 1000000
	local rig15 = Mock.makeRig(character15, "R15")
	local orig15 = {}
	for key, joint in pairs(rig15) do
		orig15[key] = joint.C0
	end
	Mock.run(0.6)
	local tool15
	if EXPECT.mode == "commandbar" then
		tool15 = StarterPack:FindFirstChild(EXPECT.name):Clone()
		tool15.Parent = backpack2
		local sc = descendantsOfClass(tool15, "Script")[1]
		__runSource(sc.Source, sc)
		Mock.run(0.1)
	else
		tool15 = backpack2:FindFirstChild(EXPECT.name)
	end
	check(tool15 ~= nil, "the second player got a sword too")
	if not tool15 then
		return
	end
	startAnimator(tool15)
	tool15.Parent = character15
	Mock.run(0.2)

	local counter = 1000
	local function drive(host, id, u, dur)
		counter += 1
		host:SetAttribute("SFIdle", "")
		host:SetAttribute("SFPlay", string.format("%s|%.3f|%.3f|%d", id, workspace:GetServerTimeNow() - u * dur / 0.001, 0.001, counter))
	end

	for _, sample in ipairs(ANIM.samples) do
		for _, which in ipairs({ "R6", "R15" }) do
			local host = which == "R6" and tool or tool15
			local joints = which == "R6" and rig6 or rig15
			local orig = which == "R6" and orig6 or orig15
			drive(host, sample.id, sample.u, sample.dur)
			Mock.run(0.4) -- the cross-fade is long over
			local want = expectedFor(which, orig, sample.m, sample.dy, sample.dz)
			local bad = {}
			for key, cf in pairs(want) do
				if joints[key] and not near(joints[key].C0, cf) then
					table.insert(bad, key)
				end
			end
			table.sort(bad)
			check(#bad == 0, which .. " pose of " .. sample.id .. " at u=" .. sample.u .. " matches the JS math" .. (#bad > 0 and (" (wrong: " .. table.concat(bad, ",") .. ")") or ""))
		end
	end

	-- both bodies are moved by the animator at the same time, and putting the sword away restores them
	tool15.Parent = backpack2
	Mock.run(0.3)
	local restored = true
	for key, joint in pairs(rig15) do
		if not near(joint.C0, orig15[key]) then
			restored = false
		end
	end
	check(restored, "R15 joints are restored when the sword is put away")
end

------------------------------------------------------------------ unequip + cleanup
tool.Parent = backpack
Mock.run(0.4)
check((tool.Grip.LookVector - baseLook).Magnitude < 1e-6, "grip restored on unequip")
if ANIM then
	local restored6 = true
	for key, joint in pairs(rig6) do
		local o = orig6[key]
		if (joint.C0.Position - o.Position).Magnitude > 1e-6 or math.abs(joint.C0.r[1] - o.r[1]) > 1e-6 or math.abs(joint.C0.r[5] - o.r[5]) > 1e-6 then
			restored6 = false
		end
	end
	check(restored6, "R6 joints are restored when the sword is put away")
	check(tool:GetAttribute("SFIdle") == "", "SFIdle is cleared on unequip")
end
for _, t in ipairs(trails) do
	if t:GetAttribute("Trigger") == "swing" then
		check(t.Enabled == false, "swing trail off after unequip")
	end
end
-- swinging while not equipped does nothing
Mock.run(15) -- let burning / poison finish first
local hurtBefore = 1000000 - dummyHum.Health
tool:Activate()
Mock.run(1)
check(1000000 - dummyHum.Health == hurtBefore, "an unequipped sword does nothing")

-- re-equip works again
tool.Parent = character
Mock.run(0.2)
check(tool.Parent == character, "re-equipped")
tool.Parent = backpack
Mock.run(0.2)

-- let everything finish, then verify nothing is leaking
Mock.run(8)
local leaks = 0
for _, d in ipairs(workspace:GetDescendants()) do
	if d.Name == "SwordWave" or d.Name == "SwordLightning" or d.Name == "SwordPush" or d.Name == "SwordPushPoint" then
		leaks += 1
	end
end
check(leaks == 0, "no leftover temporary parts")
check(#character:GetChildren() >= 3, "character still has its parts")

------------------------------------------------------------------ report problems the mock noticed
for _, err in ipairs(Mock.errors) do
	check(false, "script error: " .. err)
end
for _, w in ipairs(Mock.warnings) do
	check(false, "warning: " .. w)
end
