- John rust, 1987, ecta, Bus Engine Replacement Model
- setting
	- The agent can decide to replace the bus engine with a new one, at a cost
	- The older the bus is, the most costly it is to maintain
	- What is the best moment to replace the engine?
- State
	- State: mileage of the bus $$s_t \in \lbrace 1, …, 10 \rbrace$$
	- State transitions: with probability $$\lambda$$ the mileage of the bus increases
		- $$s_{t+1} = \begin{cases}
			\min \lbrace s_t + 1,10 \rbrace	& \text { with probability } \lambda \newline
			s_t & \text { with probability } 1 - \lambda
			\end{cases}$$
	- Note that $$\lambda$$ does not depend on the value of the state
- actions and payoffs
	- action - $$a_t \in \{0, 1\}$$
	- payoffs - cost of replacement and maintenance cost
		- $$u\left(s_{t}, a_{t}, \epsilon_{1 t}, \epsilon_{2 t} ; \theta\right)=
			\begin{cases}
			-\theta_{1} s_{t}-\theta_{2} s_{t}^{2}+\epsilon_{0 t}, & \text { if } a_{t}=0 \newline
			-\theta_{3} + \epsilon_{1t}, & \text { if } a_{t}=1
			\end{cases}$$
- estimation
	- first solve for the value function - VFI
	- $$\bar V(s_t) = \begin{cases}
		-\theta_1 s_t - \theta_2 s_t^2 + \beta \Big[(1-\lambda) V(s_t) + \lambda V(\min \lbrace s_t+1,10 \rbrace ) \Big] , & \text { if } a_t=0 \newline
		-\theta_3 + \beta \Big[(1-\lambda) V(0) + \lambda V(1) \Big] , & \text { if } a_t=1
		\end{cases}$$
	- 